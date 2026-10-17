// OhmyManual file opener. Invoked by the "ohmyopen:" URL protocol (see register.cmd).
// Opens a local file with its Windows default program (txt -> Notepad, docx -> Word, ...).
// Messages are English-only: wscript reads this file in the ANSI code page.

var BLOCKED = /\.(exe|com|bat|cmd|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|msi|msp|scr|pif|lnk|url|hta|cpl|jar|reg|dll|sys|inf|msc|application|gadget)$/i;

var shell = new ActiveXObject("WScript.Shell");

function fail(msg) {
  shell.Popup(msg, 0, "OhmyManual", 48);
  WScript.Quit(1);
}

if (WScript.Arguments.length < 1) fail("No argument was given.");

var arg = String(WScript.Arguments(0));
var m = /^ohmyopen:\/{0,3}open\?p=([^&#]+)/i.exec(arg);
if (!m) fail("Unsupported link:\n" + arg);

var path;
try {
  path = decodeURIComponent(m[1]);
} catch (e) {
  fail("Invalid path encoding.");
}

path = path.replace(/\//g, "\\");

if (!/^([A-Za-z]:\\|\\\\[^\\])/.test(path)) fail("Only absolute drive or network paths are allowed:\n" + path);
if (BLOCKED.test(path)) fail("This file type is blocked for safety:\n" + path);

var fso = new ActiveXObject("Scripting.FileSystemObject");
if (!fso.FileExists(path)) fail("File not found:\n" + path);

new ActiveXObject("Shell.Application").ShellExecute(path, "", "", "open", 1);
