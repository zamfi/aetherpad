import("gae.channel");
import("gae.dsobj");
import("etherpad.log");
import("etherpad.utils");
import("fastJSON");
import("stringutils.startsWith");
import("gae.taskqueue");
import("etherpad.control.integergrab_memcache");
jimport("com.google.appengine.api.channel.ChannelServiceFactory");

function render_newchannel() {
  var appKey = request.params.appKey;
  response.setContentType("application/json");
  response.write(fastJSON.stringify({ token: channel.createChannel(appKey) }));
}

function validateAppKeyDate(appKey) {
  var d = Number(appKey.split("-")[2]);
  return (+new Date() - d < 2*3600*1000) // two hours
}

function render_send() {
  var appKey = request.params.appKey;
  if (! validateAppKeyDate(appKey)) {
    response.setContentType("application/json");
    response.write(fastJSON.stringify({ status: "appkey-expired" }));
    serverhandlers.cometHandler("disconnect", appKey);
    return;
  }
  var messages = fastJSON.parse(request.params.messages).a;
  messages.forEach(function(msg) {
    // keep all messages from the channelcontrol key local to this module.
    if (startsWith(appKey, "integergrab.test-")) {
      integergrab_memcache.handleComet("message", appKey, msg);
      return;
    }
    if (startsWith(appKey, "channelcontrol.test-")) {
      handleComet("message", appKey, msg);
      return;
    }
    log.info("message from: "+appKey);
    serverhandlers.cometHandler("message", appKey, msg);
  });
  response.setContentType("application/json");
  response.write(fastJSON.stringify({ status: "ok" }));
}

function handle_connected() {
  presence = ChannelServiceFactory.getChannelService().parsePresence(request.underlying);
  log.info("connected: "+presence.clientId());
  serverhandlers.cometHandler("connect", presence.clientId());
}

function handle_disconnected() {
  presence = ChannelServiceFactory.getChannelService().parsePresence(request.underlying);
  log.info("disconnected: "+presence.clientId());
  serverhandlers.cometHandler("disconnect", presence.clientId());
}

/**
 * These functions below are all part of the "super happy chat" test,
 * and not part of the channel infrastructure.
 */
function render_test() {
  if (USE_DATASTORE_FOR_MESSAGES) {
    var messages =
      dsobj.selectMulti(tableName, {}, {orderBy: "-date", limit: 10}).map(function(msg) {
	return { date: msg.date, content: msg.content };
      });
  }
  else {
    var messages = [];
  }

  var html = utils.renderTemplateAsString("misc/channeltest.ejs", { messages: fastJSON.stringify({ a: messages.reverse()}) });
  response.write(html);
}

function render_testdisconnect() {
  var allConnections;
  if (USE_DATASTORE_FOR_CONNECTIONS) {
    allConnections = dsobj.selectMulti(connections, {});
  } else {
    allConnections = connectionsArray;
  }

  allConnections.forEach(function(conn) {
    channel.sendDisconnect(conn.appKey, fastJSON.stringify({type: "msg", content: "GOODBYE!", date: +(new Date)}));
  });

  if (USE_DATASTORE_FOR_CONNECTIONS) {
    allConnections.forEach(function(conn) {
      dsobj.deleteRows(connections, conn);
    });
  } else {
    connectionsArray = [];
  }
}

var tableName = "CHANNELTEST_MESSAGES";
var connections = "CHANNELTEST_CONNECTIONS";
var connectionsArray = [];
var USE_DATASTORE_FOR_CONNECTIONS = true;
var USE_DATASTORE_FOR_MESSAGES = true;

function newUser(appKey) {
  if (USE_DATASTORE_FOR_CONNECTIONS) {
    dsobj.insert(connections, {appKey: appKey});
  }
  else {
    connectionsArray.push({appKey: appKey});
  }
}

function handleComet(op, appKey, data) {
  if (startsWith(data, "join:")) {
    newUser(appKey);
  } else if (startsWith(data, "msg:")) {
    var content = data.substr("msg:".length);
    var obj = {type: "msg", content: content, date: +(new Date)};
    if (USE_DATASTORE_FOR_MESSAGES) {
      dsobj.insert(tableName, obj);
    }
    if (USE_DATASTORE_FOR_CONNECTIONS) {
      var allConnections = dsobj.selectMulti(connections, {});
    }
    else {
      var allConnections = connectionsArray;
    }
    var invalidConnections = [];
    var json = fastJSON.stringify(obj);

    var sendResults = channel.sendMessageBatch(
      allConnections.map(function(connection) {return connection.appKey}),
      json);

    sendResults.forEach(function(e, i) {
      if (e) {
        invalidConnections.push(allConnections[i]);
      }
    });

    // for (var i = 0; i < allConnections.length; ++i) {
    //   try {
    //     var key = allConnections[i].appKey;
    //     // if (appKey != key) {
    //       channel.sendMessage(allConnections[i].appKey, json);
    //     // } else {
    //     //   channel.sendMessage(appKey, fastJSON.stringify({type: "msgok", date: obj.date}));
    //     // }
    //   } catch (e) {
    //     if (e instanceof java.com.google.appengine.api.channel.ChannelFailureException) {
    //       invalidConnections.push(allConnections[i]);
    //     }
    //   }
    // }
    if (USE_DATASTORE_FOR_CONNECTIONS) {
      invalidConnections.forEach(function(obj) { dsobj.deleteRows(connections, obj); });
    }
    else {
      invalidConnections.forEach(function(obj) {
	      connectionsArray = connectionsArray.filter(function(obj2) {
	        return obj2.appKey != obj.appKey;
	      });
      });
    }
  }
}
