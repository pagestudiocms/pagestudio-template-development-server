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

module.exports = function(req, res, next) {
  if (req.url === '/json') {
    // var uri = require("url").parse(req.url,true);
    var response = '';
    phpserver(apppath + 'server.php', abspath + '/etc/php/php-cgi.exe', function(error, php, output){

      php.parser('default', '{"name": "Jumbo"}', function(error, result, output, printed){
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