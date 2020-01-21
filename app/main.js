function replaceIframeContent(iframeElement, newHTML){
  iframeElement.src = "about:blank";
  iframeElement.contentWindow.document.open();
  iframeElement.contentWindow.document.write(newHTML);
  iframeElement.contentWindow.document.close();
}

var run = function () {
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      let iframe = document.getElementById('viewport');
      var response = xhttp.responseText;
      var content = JSON.parse(response);

      setTimeout(()=>{
        console.log(content);
        replaceIframeContent(iframe, content.html);
        // iframe.src = content.url;
      }, 200);

    }
  };
  xhttp.open("GET", "/data", true);
  xhttp.send();
}; 

run();