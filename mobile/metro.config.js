const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('@expo/metro-config');

// On Windows, directories inside cloud-synced folders (e.g. OneDrive) have
// FILE_ATTRIBUTE_REPARSE_POINT set. Node's `fs.readdir({ withFileTypes: true })`
// reports these entries as `isSymbolicLink() === true` (UV_DIRENT_LINK).
// `@expo/metro-file-map` optimizes file crawling by trusting `entry.isSymbolicLink()`,
// which causes real files to be treated as symlinks and subsequently dropped when
// `fs.readlink` fails with EINVAL.
// Patch `fs.Dirent` on Windows to check `lstatSync` when an apparent symlink is detected.
if (process.platform === 'win32' && fs.Dirent) {
  const origIsSymbolicLink = fs.Dirent.prototype.isSymbolicLink;
  const origIsFile = fs.Dirent.prototype.isFile;
  const origIsDirectory = fs.Dirent.prototype.isDirectory;

  function getResolvedStat(dirent) {
    if (dirent._resolvedStat !== undefined) return dirent._resolvedStat;
    const p = dirent.parentPath
      ? path.join(dirent.parentPath, dirent.name)
      : (dirent.path ? path.join(dirent.path, dirent.name) : null);
    if (!p) {
      dirent._resolvedStat = null;
      return null;
    }
    try {
      dirent._resolvedStat = fs.lstatSync(p);
    } catch {
      dirent._resolvedStat = null;
    }
    return dirent._resolvedStat;
  }

  fs.Dirent.prototype.isSymbolicLink = function () {
    if (!origIsSymbolicLink.call(this)) return false;
    const stat = getResolvedStat(this);
    return stat ? stat.isSymbolicLink() : origIsSymbolicLink.call(this);
  };

  fs.Dirent.prototype.isFile = function () {
    if (origIsFile.call(this)) return true;
    const stat = getResolvedStat(this);
    return stat ? stat.isFile() : false;
  };

  fs.Dirent.prototype.isDirectory = function () {
    if (origIsDirectory.call(this)) return true;
    const stat = getResolvedStat(this);
    return stat ? stat.isDirectory() : false;
  };
}

const config = getDefaultConfig(__dirname);

// Ensure project root is explicitly in watchFolders
config.watchFolders = [__dirname];

// Disable experimental package exports which fails on Windows in Metro 0.84
config.resolver.unstable_enablePackageExports = false;

// Ensure sourceExts includes all standard extensions
if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

module.exports = config;
