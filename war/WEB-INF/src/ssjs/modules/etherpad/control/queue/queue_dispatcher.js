
import("fastJSON");

import("etherpad.control.queue.test_queue");

jimport("java.lang.System.out.println");

function onRequest(name) {
  var args = fastJSON.parse(request.bodyString);
  var taskName = request.headers['X-AppEngine-TaskName'];
  if (name == "test") {
    test_queue.execute(taskName, args);
    return true;
  } else {
    return false;
  }
}


