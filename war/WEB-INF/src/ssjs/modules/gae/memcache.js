// Easy wrapper for memcache Java library.
//

jimport("com.google.appengine.api.memcache.ErrorHandler");
jimport("com.google.appengine.api.memcache.Expiration");
jimport("com.google.appengine.api.memcache.MemcacheService");
jimport("com.google.appengine.api.memcache.MemcacheService.SetPolicy.ADD_ONLY_IF_NOT_PRESENT");
jimport("com.google.appengine.api.memcache.MemcacheService.SetPolicy.REPLACE_ONLY_IF_PRESENT");
jimport("com.google.appengine.api.memcache.MemcacheService.SetPolicy.SET_ALWAYS");
jimport("com.google.appengine.api.memcache.MemcacheServiceFactory");


// 20 years in future
var FAR_IN_FUTURE = Expiration.byDeltaSeconds(60 * 60 * 24 * 365 * 20);


function _ms() {
  return MemcacheServiceFactory.getMemcacheService();
}

function get(key) {
  return MemcacheServiceFactory.getMemcacheService().get(key);
}

function increment(key, delta, init) {
  if (init) {
    return _ms().increment(key, Number(delta), Number(init));
  } else {
    return _ms().increment(key, Number(delta));
  }
}

function putWithPolicy(key, value, policy) {
  return _ms().put(key, value, null, policy);
}

function putOnlyIfNotPresent(key, value) {
  return putWithPolicy(key, value, ADD_ONLY_IF_NOT_PRESENT);
}

function put(key, value) {
  return putWithPolicy(key, value, SET_ALWAYS);
}

function remove(key) {
  return _ms()['delete'](key);
}

function clearAll() {
  _ms().clearAll();
}