const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const errToJSON = require('error-to-json');
const {dependencyTypes} = require('./common/enums');
const {socketPromisedHandler} = require('./common/sockets');

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
  console.log('a user connected');
});

var workerIo =  io.of('worker')
workerIo.on('connection', function(socket){
  console.log('a worker connected');

  socket.on('report',projectId=>{
  	console.log('report',projectId)
  })

  socketPromisedHandler('getFunction',socket, async params=>{
  	console.log('getFunction', params);
  	return dependencies.find(f=>f.name==params.name);
  });

  socketPromisedHandler('pullDependenciesCheck',socket, async params=>{
  	return dependencies.map(f=>({n:f.name,v:f.version||0}));
  });

  socketPromisedHandler('fetchDependencies',socket, async params=>{
  	return dependencies;
  });

});

http.listen(3001, function(){
  console.log('listening on *:3001');
});




var dependencies = [{
	project: 1,
	name: "foo",
	type: dependencyTypes.action,
	version: 1,
	dependencies: [],
	code: `
		function foo(){
			return new Promise((resolve,reject)=>{
				//reject(new Error('FooFail'))
					console.log('Foo!')
					resolve('FOO_RESULT')
				
			})
			
		}
		async function test(){
			await foo();
			return true;
		}
		`
}, {
	name: "bar",
	dependencies: ['foo'],
	code: `
		async function bar(){
			console.log('Bar start')
			var fooR = await foo()
			console.log('Bar end')
			return fooR;
		}
		async function test(){
			await bar();
			return true;
		}
		`
}];