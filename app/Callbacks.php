<?php 

class Callbacks
{
    public function example($trigger, $parameters, $content, $data) 
    {
        if (isset($data[$trigger]) && $data[$trigger] != ''){
            
        }
        return '[Example Callback]';
    }
}

class BuilderCallbacks
{
    public function toolbar($data)
    {
        return '[toolbar_callback]';
    }
}