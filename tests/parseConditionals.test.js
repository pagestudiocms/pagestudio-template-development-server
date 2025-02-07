const LexParser = require('../lib/lexParser'); // Adjust the path as needed

const parser = new LexParser();

const template1 = `
  {{ if "one"=="one" }}
    <p>Evaluates to true!</p>
  {{ else }}
    <p>Evaluates to false!</p>
  {{ endif }}

  {{ if user.name }}
    <p>Hello, {{ user.name }}!</p>
  {{ else }}
    <p>Hello, Guest!</p>
  {{ endif }}

  {{ if user.exists }}
    <p>User exists.</p>
  {{ endif }}

  {{ if not user.admin }}
    <p>User is not an admin.</p>
  {{ endif }}

  {{ if page.slug == 'templates' }}
    <h1>Foo Exists</h1>
  {{ elseif not exists foo }}
    <h1>Foo Does Not Exist</h1>
  {{ endif }}
  
  {{ if page.slug == "" || page.slug == "templates" }}
    <p>The page slug is: {{ page.slug }}</p>
  {{ endif }}
`;

const template2 = `
  <nav id="primary-nav" class="navbar " role="navigation" 
    data-content-field="header-content"
    data-navbar-type="offcanvas" 
    data-navbar-transitioned="navbar-default">
    
    <div class="container-fluid">
        <div class="navbar-header">
            <a href="default.html" class="navbar-brand">
                <!-- <img src="images/logo-white_175x15.png" class="navbar-transparent--navbar-brand-image" alt="PageStudio CMS"> -->
                <img src="images/logo_175x15.png" class="navbar-default--navbar-brand-image" alt="PageStudio CMS">
                <!-- <span class="hidden site-slogan"></span> -->
                <!-- <span>Nature</span> Call -->
            </a>
            <button type="button" class="navbar-toggle offcanvas-toggle js-menu-toggle">
            <!-- <button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#example-overlay-one" data-target-original="example-overlay-one"> -->
            <!-- <button type="button" class="navbar-toggle offcanvas-toggle js-offcanvas-has-events" data-toggle="offcanvas"
                data-target="#example-offcanvas-three" data-target-original="#example-offcanvas-three"> -->
                <span class="sr-only">Toggle navigation</span>
                <span>
                    <i class="icon-bar"></i>
                    <i class="icon-bar"></i>
                    <i class="icon-bar"></i>
                </span>
            </button>
        </div>
        <!-- Collect the nav links, forms, and other content for toggling -->
        <div class="navbar-offcanvas navbar-offcanvas-touch offcanvas-transform js-offcanvas-done"
            id="example-offcanvas-three">
            <!-- <div class="collapse navbar-collapse" id="example-overlay-one"> -->
            <ul class="nav navbar-nav navbar-right js-clone-nav">
                <li class="first active"><a href="default.html">Home</a></li>
                <li class="dropdown">
                    <a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true"
                        aria-expanded="false">Pages <span class="caret"></span></a>
                    <ul class="dropdown-menu">
                        <li><a href="about.html">About</a></li>
                        <li><a href="dashboard.html">Dashboard</a></li>
                        <li><a href="checkout.html">Checkout</a></li>
                        <li><a href="#">Something else here</a></li>
                        <li role="separator" class="divider"></li>
                        <li><a href="#">Separated link</a></li>
                        <li role="separator" class="divider"></li>
                        <li><a href="#">One more separated link</a></li>
                    </ul>
                </li>
                <li><a href="posts.html">Blog</a></li>
                <li><a href="components.html">Components</a></li>
                <li class="btn-cta btn-cta--blue"><a href="templates.html">Get Started</a></li>
            </ul>
        </div>
        <!-- /.navbar-collapse -->
    </div>
  </nav>`;

const data1 = {
  user: {
    name: 'John',
    age: 25,
    exists: true,
    admin: false
  }, 
  page: {
    title: 'Templates', 
    slug: 'templates'
  },
};

const data2 = {
  user: {
    age: 17,
    exists: false,
    admin: true
  }
};

function runTests() {
  const result1 = parser.parse(template1, data1);
  console.log(`Test 1 Result:\n`, result1.replace(/\n\s*\n/g, '\n'), '\n');

  // const result2 = parser.parse(template, data2);
  // console.log('Test 2 Result:\n', result2.replace(/\n\s*\n/g, '\n'));
}

runTests();