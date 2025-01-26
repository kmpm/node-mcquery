# Node-MCQuery

__Archival notice!!!__ This project is currently archived because of lack of time
and interest. I no longer use NodeMCU in any form. But someone else might be.
If you want to post a notice here about your active alternative then send me a
DM here on github.

----

A library for accessing a Minecraft server using the Query protocol

If you need to run under node < 8.0.0 then you have to use a version < 1.0.0 of this library

## Status
[![CI Testing](https://github.com/kmpm/node-mcquery/actions/workflows/main.yml/badge.svg)](https://github.com/kmpm/node-mcquery/actions/workflows/main.yml)


## References ##
* http://wiki.vg/Query


## FAQ
__Q__: Response attribute `hostname`  returns the server motd on full_stat.

__A__: Correct. That is according to the definition in https://wiki.vg/Query#Full_stat .
The response from the server uses the keyword `hostname` for the MOTD data.
```javascript
{ type: 0,
  sessionId: 1,
  hostname: 'A Vanilla Minecraft Server powered by Docker',
  gametype: 'SMP',
  game_id: 'MINECRAFT',
  version: '1.15.2',
  plugins: '',
  map: 'world',
  numplayers: '0',
  maxplayers: '20',
  hostport: '25565',
  hostip: '172.18.0.2',
  player_: [],
  from: { address: '127.0.0.1', port: 25565 } }
```

## License
(The MIT License)

Copyright (c) 2011-2020 Peter Magnusson &lt;peter@kmpm.se&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
