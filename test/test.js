
/*global describe it before after */

var assert = require('assert');

var server ={
    host: 'srv8.streamcraft.net',
    port: 33334
};

var Query = require('../mcquery');

var global_query = new Query('srv1.streamcraft.net', 11111);

describe('mcquery', function() {
    
    describe('after connection', function(){
        before(function(done){
            this.timeout(5000);
            global_query.connect(function(err, session){
                assert.isNull(err);
            });    
        });
        
        after(function(done){
            global_query.close;    
        });
        
        it('basic_stat should work', function(done){
           global_query.basic_stat(done); 
        });
        
    });
    
});