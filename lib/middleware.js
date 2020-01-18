/*!
 *
 * Development Server 
 *
 */

"use strict";

const path = require("path");
const abspath = path.join(__dirname, '../');
const apppath = path.join(abspath, 'app/');
const binpath = path.join(abspath, 'bin/');
const libpath = path.join(abspath, 'lib/');
const phpserver = require('exec-php');
const fs = require( "fs" );
const bodyParser = require( "body-parser" );
const slug = require( "slug" );
// const xkeychain = require( "xkeychain" );
const open = require( "open" );
const util = require(libpath + 'utils');

module.exports = function(req, res, next) {
  if (req.url === '/json') {
    // var uri = require("url").parse(req.url,true);
    var response = '';
    var reqJson = JSON.stringify(res, util.circularReplacer()); // -- Debugging purposes only 

    phpserver(apppath + 'server.php', abspath + '/etc/php/php-cgi.exe', function(error, php, output){
      php.parser('default', '', function(error, result, output, printed){
        if(error){
          console.log(error);
        }
        // Write to file... precursor to caching 
        // fs.writeFile(path.join(abspath, ".cache/test.cache"), result, function(err) {
        //   if(err) {
        //     return console.log(err);
        //   }
        //   console.log("The file was saved!");
        // });
        // TODO: Set status 200, etc.
        response = result;
        // res.setHeader('Content-Type', 'application/json');
        res.end(response);
      });
    });
  } else {
    next();
  } 
}