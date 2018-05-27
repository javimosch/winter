const dependencyTypes = {
	preMiddleware:'preMiddleware',
	action:'action',
	postMiddleware:'postMiddleware'
};
const dependencyStatus = {
	pending:"pending",
	passed:"passed",
	errored:"errored"
};

module.exports = {
	dependencyTypes,
	dependencyStatus
};