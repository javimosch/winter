  const sizeof = require('object-sizeof');

  module.exports = {
      sizeof,
      bytesToSize,
      bytesToSizeFormatted
  };

  function bytesToSizeFormatted(bytes) {
      var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      if (bytes == 0) return 'n/a';
      var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
      if (i == 0) return bytes + ' ' + sizes[i];
      return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
  };

  function bytesToSize(bytes) {
      if (bytes == 0) return 0;
      var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
      if (i == 0) return 0;
      if (i > 1) return 999;
      return (bytes / Math.pow(1024, i));
  };