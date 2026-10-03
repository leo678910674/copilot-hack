using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Forms;

internal static class Bootstrapper
{
    private static readonly byte[] Magic = Encoding.ASCII.GetBytes("MANMANLAISETUP1");

    [STAThread]
    private static int Main()
    {
        string extractionDirectory = null;
        try
        {
            byte[] executable = File.ReadAllBytes(Application.ExecutablePath);
            int footerLength = Magic.Length + sizeof(long);
            if (executable.Length < footerLength)
            {
                throw new InvalidDataException("The installer package is incomplete.");
            }

            int footerOffset = executable.Length - footerLength;
            for (int index = 0; index < Magic.Length; index++)
            {
                if (executable[footerOffset + sizeof(long) + index] != Magic[index])
                {
                    throw new InvalidDataException("The installer package is invalid.");
                }
            }

            long payloadLength = BitConverter.ToInt64(executable, footerOffset);
            long payloadOffset = footerOffset - payloadLength;
            if (payloadLength <= 0 || payloadOffset < 0 || payloadOffset > int.MaxValue || payloadLength > int.MaxValue)
            {
                throw new InvalidDataException("The installer payload has an invalid size.");
            }

            extractionDirectory = Path.Combine(Path.GetTempPath(), "Manmanlai-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(extractionDirectory);
            byte[] payloadBytes = new byte[(int)payloadLength];
            Buffer.BlockCopy(executable, (int)payloadOffset, payloadBytes, 0, payloadBytes.Length);
            using (MemoryStream payload = new MemoryStream(payloadBytes))
            using (BinaryReader reader = new BinaryReader(payload, Encoding.UTF8))
            {
                int fileCount = reader.ReadInt32();
                if (fileCount < 1 || fileCount > 100)
                {
                    throw new InvalidDataException("The installer file list is invalid.");
                }

                for (int index = 0; index < fileCount; index++)
                {
                    int nameLength = reader.ReadInt32();
                    if (nameLength < 1 || nameLength > 1024)
                    {
                        throw new InvalidDataException("An installer file name is invalid.");
                    }

                    byte[] nameBytes = reader.ReadBytes(nameLength);
                    if (nameBytes.Length != nameLength)
                    {
                        throw new InvalidDataException("An installer file name is incomplete.");
                    }

                    string name = Encoding.UTF8.GetString(nameBytes).Replace('/', Path.DirectorySeparatorChar);
                    string target = Path.GetFullPath(Path.Combine(extractionDirectory, name));
                    string root = Path.GetFullPath(extractionDirectory) + Path.DirectorySeparatorChar;
                    if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidDataException("An installer file path is invalid.");
                    }

                    long contentLength = reader.ReadInt64();
                    if (contentLength < 0 || contentLength > reader.BaseStream.Length - reader.BaseStream.Position || contentLength > int.MaxValue)
                    {
                        throw new InvalidDataException("An installer file is incomplete: " + name);
                    }

                    byte[] content = reader.ReadBytes((int)contentLength);
                    if (content.Length != contentLength)
                    {
                        throw new InvalidDataException("An installer file is incomplete: " + name);
                    }

                    Directory.CreateDirectory(Path.GetDirectoryName(target));
                    File.WriteAllBytes(target, content);
                }

                if (reader.BaseStream.Position != reader.BaseStream.Length)
                {
                    throw new InvalidDataException("The installer payload contains unexpected data.");
                }
            }

            string powershell = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = powershell;
            startInfo.Arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File \"" + Path.Combine(extractionDirectory, "Install.ps1") + "\"";
            startInfo.WorkingDirectory = extractionDirectory;
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;
            using (Process installer = Process.Start(startInfo))
            {
                installer.WaitForExit();
                return installer.ExitCode;
            }
        }
        catch (Exception error)
        {
            MessageBox.Show("安装失败：" + error.Message, "慢慢来安装程序", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
        finally
        {
            if (!String.IsNullOrEmpty(extractionDirectory))
            {
                try
                {
                    Directory.Delete(extractionDirectory, true);
                }
                catch
                {
                }
            }
        }
    }
}
