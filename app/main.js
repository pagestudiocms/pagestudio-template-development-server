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
      var content = xhttp.responseText;
      let iframe = document.getElementById('viewport');
      replaceIframeContent(iframe, content);
    }
  };
  xhttp.open("GET", "/json", true);
  xhttp.send();
}; 

run();