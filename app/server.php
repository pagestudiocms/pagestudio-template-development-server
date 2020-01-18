<?php 

/**
 *
 * Development Server 
 *
 */

error_reporting(E_ALL & ~E_NOTICE);
ini_set("log_errors", 1);

$DS = DIRECTORY_SEPARATOR;
define('ABSPATH', dirname(__DIR__, 1) . $DS);
define('APPPATH', ABSPATH . 'app' . $DS);
define('TEMPLATE_PATH', ABSPATH . 'template' . $DS . 'build' . $DS);

ini_set("error_log", ABSPATH . str_replace('/', $DS , 'var/log/php-error.log'));

global $callbacks;
$callbacks = [];

function greet($name){
    return json_encode([
        "data" => [
            "portlets" => []
        ],
        "status" => "success",
    ]);
}

function parser_callback($plugin, $attributes, $content, $data = ''){
    // Check if there were custom global callbacks defined
    $return_data = "[{$plugin}_callback]";
    global $callbacks;

    if (strpos($plugin, ':') !== FALSE){
        list($class, $method) = explode(':', $plugin);
        $className = ucfirst(strtolower($class)) . 'Callbacks';
        $obj = new $className;
        if (is_callable([$obj, $method])){
            $return_data = $obj->{$method};
            $return_data = call_user_func([$obj, $method], $data);
        }        

    } else if (isset($callbacks[$plugin])) {
        $callback = $callbacks[$plugin];
        if (is_callable($callback)){
            $return_data = call_user_func_array($callback, array($plugin, $attributes, $content, $data));
        }
    }
    return $return_data;
}

function set_callback($trigger, $callback){
    global $callbacks;
    $callbacks[$trigger] = $callback;
}

function parser($html = '', $json = ''){
    include_once APPPATH . 'LexParser.php';
    include_once APPPATH . 'Callbacks.php';

    $parser = new LexParser();
    $parser->scope_glue(':');
    set_callback('builder', [new BuilderCallbacks, 'toolbar']);

    if(empty($html)){
        return '';
        exit;
    }

    $data = [
        'site' => [
            'title' => 'My New Website', 
            'slogan' => '', 
            'url' => '#'
        ]
    ];

    $html = file_get_contents(TEMPLATE_PATH . 'index.html');

    /**
     * 
     * parse_string([]:string, [data]:array, [return]:bool, [bool]);
     * 
     */
    $parsed = $parser->parse($html, $data, 'parser_callback');

    return $parsed;
}