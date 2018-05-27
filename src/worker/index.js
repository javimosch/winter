// ||
const reload = require('require-reload')(require);
const sander = require('sander');
const shortid = require('shortid');
const errToJSON = require('error-to-json');
const tempDir = require('temp-dir');
const requireFromString = require('require-from-string');
const path = require('path');
const parallel = require('promise-parallel');
const sequential = require('promise-sequential');
const bodyParser = require('body-parser');
const parseForm = bodyParser.urlencoded({
	extended: false
});
const parseJson = bodyParser.json();
const _ = require('lodash');
const {
	dependencyTypes,
	dependencyStatus
} = require('../common/enums');
const {
	socketPromise
} = require('../common/sockets');
const {
	writeAndReloadModule,
	createLocalCache
} = require('../common/fs');
const {
	normalizeError
} = require('../common/errors');


var localCache = createLocalCache(__dirname + '/db.json');

var state = {
	deps: {
		/*
		dep_name:{
			name:
			type: dependencyTypes,
			version:
			dependencies:
			code:
			def: (live module definition),
			err: (normalized error)
			preMiddlewares:
			postMiddlewares:
			status: dependencyStatus
		}
		*/
	}
};

var app = require('express')();
var http = require('http').Server(app);
var socket = require('socket.io-client')('http://localhost:3001/worker');
var projectId = 'project1Id';

socket.on('connect', onSocketConnect);
socket.on('event', function(data) {});
socket.on('disconnect', function() {});

app.get('/', function(req, res) {
	res.send('<h1>Hello world</h1>');
});

app.post('/api/:name', parseJson, async function(req, res) {
	try {
		//valdate request
		var params = req.body || {};
		var name = req.params.name;
		if (!params || !name) return res.status(400).send()

		//get function
		await syncronizeDependency(name);
		var dependency = getDependency(name);

		var dependencyScope = {
			req: req,
			res: res
		};

		var response = {};
		//pre middlewares
		response = await callPreMiddlewares(dependency, params);
		//return res.status(200).json(_.omit(dependency, ['def']));


		if (!response.err) {
			//action
			response.result = await callAction.apply(dependencyScope, [dependency, params, response]);
			//return res.status(200).json(response);
		}

		if (!response.err) {
			//post middlewares
			response = await callPostMiddlewares(dependency, response);
		}

		//log usage, errors, etc
		handleAfterRequest(response, params);

		res.status(200).json(response);

	} catch (err) {
		handleError(err);
		res.status(500).send()
	}

});

http.listen(3000, function() {
	console.log('listening on *:3000');
});


async function onSocketConnect() {
	try {
		socket.emit('report', projectId)

		
		localCache = await localCache;
		await localCache.set('deps',[]).write()
		


		pullDependencies(socket);


	} catch (err) {
		handleError(err);
	}
}

async function pullDependencies(socket) {
	try {
		var deps = await fetchDependencies(socket);

		await sequential(
			deps.map(dep => {
				return async () => {
					console.log('saving dep',dep.name)
					if (await localCache.get('deps').find({
							name: dep.name
						}).value()) {
						console.log('updaing')
						await localCache.get('deps').find({
							name: dep.name
						}).assign(dep).write();
					} else {
						console.log('pushing')
						await localCache.get('deps').push(dep).write();
					}
				};
			}));
		//console.log(deps)
	} catch (err) {
		handleError(err);
	}
}

async function fetchDependencies(socket) {
	return await socketPromise(socket, {
		name: 'fetchDependencies',
		params: {

		}
	});
}

async function pullDependenciesCheck(socket) {
	return await socketPromise(socket, {
		name: 'pullDependenciesCheck',
		params: {

		}
	});
}

function handleAfterRequest(response, params) {
	try {
		var payload = Object.assign({}, _.omit(response, ['result']), {
			params
		});
		socket.emit('afterRequest', payload);
		if (response.err) {
			console.error('afterRequest:', payload);
		}
	} catch (err) {
		handleError(err);
	}
}

function handleError(err) {
	console.error(err);
	socket.emit('error', errToJSON(err));
}

function hasDependency(name) {
	return state.deps[name];
}

function getDependency(name) {
	return state.deps[name];
}

async function callPreMiddlewares(data) {
	return {
		err: null
	}
}

async function callAction(dep, params, response) {
	//this: action scope
	//response: {err:, result:}
	try {
		response.result = await dep.def.apply(this, [params]);
		return response.result;
	} catch (err) {

		//WIP: call action again from fs (better error tracking)
		var source = '';
		try {
			var allDeps = getDependencies();
			var depDependencies = dep.dependencies.map(fname => allDeps.find(ff => ff.name == fname)).filter(ff => ff != null);
			var codeDependencies = ''
			codeDependencies += depDependencies.map(r => {
				return `
					${r.code}
					`;
			}).join('');
			source = `
						${codeDependencies}
					${dep.code}
					module.exports = test;
				`;
			var def = writeAndReloadModule(dep.name, source)
			await def();
			console.log('error memory')
			response.err = normalizeError(err, dep.name);
		} catch (err) {
			console.log('error fs')
			err.source = source;
			response.err = normalizeError(err, dep.name);
		}

		return null;
	}
}

function callPostMiddlewares(dep, response) {
	return response;
}

function setDependency(dep) {
	state.deps[dep.name] = dep;
	dep.def = null;
	dep.status = dependencyStatus.pending;
}

async function registerDependency(dep) {
	setDependency(dep);
	await syncronizeDependencies(dep);
	await prepareDependency(dep);
}

async function syncronizeDependencies(dep) {
	if (dep.dependencies.length === 0) return;
	return await sequential(dep.dependencies.map(name => {
		return async () => {
			return await syncronizeDependency(name);
		}
	}));
}

async function syncronizeDependency(name) {
	if (!hasDependency(name)) {
		var dep = await socketPromise(socket, {
			name: 'getFunction',
			params: {
				name
			}
		});
		if (!dep) {
			throw new Error('DEPENDENCY_NOT_FOUND')
		}
		await registerDependency(dep);
	} else {
		var dep = getDependency(name);
		if (dep.status !== dependencyStatus.passed) {
			await prepareDependency(dep);
		}
	}
}

function getDependencies() {
	return Object.keys(state.deps).map(k => state.deps[k]);
}

async function prepareDependency(dep) {
	var depsCode = getDependenciesCode(dep);
	var code = generateDependencyEvalSource(dep, depsCode);
	try {
		eval(code);
		if (typeof dep.def !== 'function') {
			throw new Error("FUNCTION_EXPECTED");
		}
		dep.status = dependencyStatus.passed;
	} catch (err) {
		try {
			writeAndReloadModule(dep.name, `
				${depsCode}
				${dep.code}
				module.exports = ${dep.name};
			`);
			err = normalizeError(err, dep.name);
			err.source = code;
			dep.err = err;
			dep.status = dependencyStatus.errored;

		} catch (err) {
			err = normalizeError(err, dep.name);
			err.source = code;
			dep.err = err;
			dep.status = dependencyStatus.errored;
		}
		handleDependencyError(dep);
	}
}

function getDependenciesCode(dep) {
	if (dep.dependencies.length == 0) return '';
	var allDeps = getDependencies();
	var depDependencies = dep.dependencies.map(fname => allDeps.find(ff => ff.name == fname)).filter(ff => ff != null);
	var codeDependencies = '';
	codeDependencies += depDependencies.map(r => {
		return `
					${r.code}
					`;
	}).join('');
	return codeDependencies;
}

function generateDependencyEvalSource(dep, depsCode) {

	var code = `
			(function ${dep.name}Module(scope){
				${depsCode}
				${dep.code}
				scope.def = ${dep.name};
				scope.test = test;
			})(dep)`;
	return code;
}

function handleDependencyError(dep) {
	console.error('Dependency error', dep.name, dep.err);
}