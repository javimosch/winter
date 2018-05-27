const tempDir = require('temp-dir');
const path = require('path');
const sander = require('sander');
const reload = require('require-reload')(require);
const shortid = require('shortid');

module.exports = {
	writeAndReloadModule,
	createLocalCache
};

function writeAndReloadModule(name, code) {
	var fsPath = path.join(tempDir, shortid.generate(), name + '.js');
	sander.writeFileSync(fsPath, code);
	return reload(fsPath);
}

function createLocalCache(name) {
	const low = require('lowdb')
	const FileSync = require('lowdb/adapters/FileAsync')
	const adapter = new FileSync(name);
	const db = low(adapter);
	return db;
}