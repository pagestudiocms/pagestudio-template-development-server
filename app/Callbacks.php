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

class HelperCallbacks
{
    /**
     * Date/Time Format Callback
     *
     * Callback to format a datetime
     *
     * @return void
     */
    public function date_format_callback($trigger, $parameters, $content, $data)
    {
        if (isset($data[$trigger]) && $data[$trigger] != '')
        {
            $date = $data[$trigger];

            if (isset($parameters['format']))
            {
                return date($parameters['format'], strtotime($date));
            }
            else
            {
                return $date;
            }
        }

        return '';
    }
}

class TemplateCallbacks
{
    public function headers($attributes, $content, $data)
    {
        $title = $data['site']['title'];
        $link = "/assets/css/style.css";
        $html = <<<HTML
    <title>Cached: $title</title>
    <link rel="stylesheet" type="text/css" href="$link" />
HTML;
        return trim($html);
    }
    
    public function footer($data)
    {
        return '[template_footer_callback]';
    }
    
    public function footers($data)
    {
        return '[template_footers_callback]';
    }

    public function partial($attributes, $content, $data)
    {
        if(isset($attributes['name']) && ! empty($attributes['name'])){
            $partial = TEMPLATE_PATH . resolve("partials/{$attributes['name']}.html");
            if(file_exists($partial)){
                return file_get_contents($partial);
            }
        }
        return '';
    }
}