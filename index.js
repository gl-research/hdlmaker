#!/usr/bin/env node

var http = require('http');
var _ = require('lodash');
var express = require('express');
var fs = require('fs');
var path = require('path');
var util = require('util');

var program = require('commander');

function collect(val, memo) {
  if(val && val.indexOf('.') != 0) val = "." + val;
  memo.push(val);
  return memo;
}

program
  .option('-p, --port <port>', 'Port to run the file-browser. Default value is 8088')
  .option('-e, --exclude <exclude>', 'File extensions to exclude. To exclude multiple extension pass -e multiple times. e.g. ( -e .js -e .cs -e .swp) ', collect, [])
  .parse(process.argv);

var app = express();
var dir =  process.cwd();
var targetDir = dir;
var targetUrl = '';
app.use(express.static(dir)); //app public directory
app.use(express.static(__dirname)); //module directory
var server = http.createServer(app);

if(!program.port) program.port = 8088;

server.listen(program.port);
console.log("Please open the link in your browser http://<YOUR-IP>:" + program.port);

app.get('/files', function(req, res) {
 var currentDir =  dir;
 var query = req.query.path || '';
 if (query) currentDir = path.join(dir, query);
 console.log("browsing ", currentDir);
 console.log("url ", req.query.path);
 targetDir = currentDir;
 targetUrl = query;
 fs.readdir(currentDir, function (err, files) {
     if (err) {
        throw err;
      }
      var data = [];
      files
      .filter(function (file) {
          return true;
      }).forEach(function (file) {
        try {
                //console.log("processing ", file);
                var isDirectory = fs.statSync(path.join(currentDir,file)).isDirectory();
                if (isDirectory) {
                  data.push({ Name : file, IsDirectory: true, Path : path.join(query, file)  });
                } else {
                  var ext = path.extname(file);
                  if(program.exclude && _.contains(program.exclude, ext)) {
                    console.log("excluding file ", file);
                    return;
                  }       
                  data.push({ Name : file, Ext : ext, IsDirectory: false, Path : path.join(query, file) });
                }

        } catch(e) {
          console.log(e); 
        }        
        
      });
      data = _.sortBy(data, function(f) { return f.Name });
      res.json(data);
  });
});

app.get('/', function(req, res) {
 res.redirect('lib/template.html'); 
});


app.use('/hierarchy_file.json', function(req, res) {
  hierarchyFile = 'http://localhost:8088/'+targetUrl+'/hierarchy.json';
  console.log("hierarchy requested: ", hierarchyFile);
  //res.redirect("http://localhost:8088/hdl/spec/rtl/hierarchy.json");
  res.redirect(hierarchyFile); 
  //res.redirect(targetDir+'/hierarchy.json'); 
});

// use socket.io
var io = require('socket.io').listen(server);

//turn off debug
io.set('log level', 1);

// define interactions with client
io.sockets.on('connection', function(socket){

    //send data to client
    setInterval(function(){
        socket.emit('date', {'date': new Date()});
    }, 1000);

    //recieve client data
    socket.on('client_data', function(data, req, res){
        process.stdout.write(data.letter);
        process.stdout.write(targetDir);
        var command = 'hdlmake';
        var options = ['list-mods', '--with-files']

        switch (data.letter) {
            case 'auto':
                command = 'hdlmake';
                options = ['auto'];
                break;
            case 'fetch':
                command = 'hdlmake';
                options = ['fetch'];
               break;
            case 'clean':
                command = 'hdlmake';
                options = ['clean'];
               break;
            case 'tree':
                command = 'hdlmake';
                options = ['tree', '--web', '--with-files'];
               break;
            case 'local':
                command = 'make';
                options = ['local'];
               break;
            case 'remote':
                command = 'make';
                options = ['remote'];
            case 'cleanmake':
                command = 'make';
                options = ['clean'];
               break;
        }

        var spawn = require('child_process').spawn;
        //var child = spawn('ls', ['-lh', '/usr']);
        var child = spawn(command , options, {
          cwd: targetDir
        });
        var chunk = '';
        var a2h = require('ansi2html-extended');
/*
        var cfg = {
            standalone: true,
            palette: {
                black: '#222222',
                white: '#eeeeee',
                bg: '#222222',
                fg: '#eeeeee',
                fg_red:'#ff0000',
                fg_red:'#ff0000',
                bg_blue:'#dd0000',
                bg_blue:'#dd0000',
                green: '#00cc3e'
            }
        }
*/
        var cfg = {
            standalone: true
        }


        //child.stdout.setEncoding('utf8');
        child.stdout.on('data', function(data) {
            //console.log('stdout: ' + data);
            chunk += data;
            socket.emit('hdlmake', {'hdlmake':a2h.fromString(cfg, chunk)});
            //Here is where the output goes
        });
        //child.stderr.setEncoding('utf8');
        child.stderr.on('data', function(data) {
            console.log('error: ' + data);
            chunk += data;
            socket.emit('hdlmake', {'hdlmake':a2h.fromString(cfg, chunk)});
            //Here is where the error output goes
        });
        child.on('close', function(code) {
            console.log('closing code: ' + code);
            socket.emit('outcome', {'outcome': code});
           //Here you can get the exit code of the script
        });

    });
});

/*
var exec = require('child_process').exec;
exec('node -v', function(error, stdout, stderr) {
    console.log('stdout: ' + stdout);
    console.log('stderr: ' + stderr);
    if (error !== null) {
        console.log('exec error: ' + error);
    }
});
*/

/*
var spawn = require('child_process').spawn;
//var child = spawn('ls', ['-lh', '/usr']);
var child = spawn('ls' , {
  cwd: '/home/javi/'
});
child.stdout.setEncoding('utf8');
child.stdout.on('data', function(data) {
    console.log('stdout: ' + data);
    //Here is where the output goes
});
child.stderr.on('data', function(data) {
    console.log('stdout: ' + data);
    //Here is where the error output goes
});
child.on('close', function(code) {
    console.log('closing code: ' + code);
    //Here you can get the exit code of the script
});
*/
