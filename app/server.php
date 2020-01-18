<?php 

/**
 *
 * Development Server 
 *
 */

error_reporting(E_ALL & ~E_NOTICE);

define('ABSPATH', dirname(__DIR__, 1) . DIRECTORY_SEPARATOR);
define('APPPATH', ABSPATH . 'app' . DIRECTORY_SEPARATOR);
define('TEMPLATE_PATH', ABSPATH . 'template' . DIRECTORY_SEPARATOR . 'build' . DIRECTORY_SEPARATOR);

function greet($name){
    return json_encode([
        "data" => [
            "portlets" => []
        ],
        "status" => "success",
    ]);
}

function parser($html = '', $json = ''){
    include_once APPPATH . 'LexParser.php';
    $parser = new LexParser();

    if(empty($html)){
        return '';
        exit;
    }

    $data = [
        'site' => [
            'title' => 'My New Website'
        ]
    ];

    $html = file_get_contents(TEMPLATE_PATH . 'index.html');

    /**
     * 
     * parse_string([]:string, [data]:array, [return]:bool, [bool]);
     * 
     */
    $parser->scope_glue(':');
    $parsed = $parser->parse($html, $data);

    return $parsed;
}
