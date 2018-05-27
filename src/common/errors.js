const errToJSON = require('error-to-json');
const tempDir = require('temp-dir');

module.exports = {
	normalizeError
};

function normalizeError(err, fileName) {
	if (err instanceof Error) {
		err = errToJSON(err);
	} else {
		if (typeof err === 'string') {
			err = {
				message: err
			};
		}
	}
	if (err.stack && fileName) {
		if (err.stack.lastIndexOf(fileName) !== -1) {
			var cut = err.stack.substring(err.stack.lastIndexOf(fileName));
			err.stack = err.stack.substr(0, err.stack.lastIndexOf(fileName) + cut.indexOf(')')) + ')';
			err.stack = err.stack.replace(new RegExp(tempDir, 'g'), '');
		}
	}
	return err;
}