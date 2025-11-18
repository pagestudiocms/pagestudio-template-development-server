Code to run php server directly for troubleshooting!

```
.\bin-php\php.exe -r "require 'C:\var\www\app-sandbox\sandbox\nodejs-server\app\server.php'; echo parser('hello');"
```

```
npm unlink -g && npm link  # Re-link globally
npm link @pagestudiocms/pagestudio-template-development-server  # Link in consumer
```