const fs = require('fs');
const path = require('path');
const {PythonShell} = require('python-shell');
const request = require('request');
const { execSync } = require('child_process')
const eaw = require('eastasianwidth'); // npm install

const jkCommentGetterPath = '/app/config/JKCommentGetter/JKCommentGetter.rb'
const mail = '';
const password = '';

const endat = Math.min(Number(process.env.ENDAT), Math.floor(new Date().getTime())) / 1000;
const chname = process.env.CHANNELNAME;
const recpath = process.env.RECPATH;
const keisu = process.env.CHANNELTYPE == 'BS' ? 1 : 0.75;
// const recpath = '/app/recorded/test.ts';
const dirname = path.dirname(recpath);
const basename = path.basename(recpath, path.extname(recpath));
const assfilename = dirname + '/' + basename + '.ass';

const chlist = {
	'ＮＨＫ総合１・東京': 'jk1',
	'ＮＨＫＥテレ１東京': 'jk2',
	'日テレ１': 'jk4',
	'テレビ朝日': 'jk5',
	'ＴＢＳ１': 'jk6',
	'テレビ東京１': 'jk7',
	'フジテレビ': 'jk8',
	'ＴＯＫＹＯ　ＭＸ１': 'jk9',
	'ＮＨＫＢＳ１': 'jk101',
	'ＮＨＫＢＳプレミアム': 'jk103',
	'ＢＳ日テレ': 'jk141',
	'ＢＳ朝日１': 'jk151',
	'ＢＳ－ＴＢＳ': 'jk161',
	'ＢＳテレ東': 'jk171',
	'ＢＳフジ・１８１': 'jk181',
	'ＷＯＷＯＷプライム': 'jk191',
	'ＷＯＷＯＷライブ': 'jk192',
	'ＷＯＷＯＷシネマ': 'jk193',
	'スターチャンネル１': 'jk200',
	'スターチャンネル２': 'jk201',
	'スターチャンネル３': 'jk202',
	'ＢＳ１１イレブン': 'jk211',
	'ＢＳ１２トゥエルビ': 'jk222',
}

var options = {
    mode: 'text',
    scriptPath: '/app/config',
    pythonOptions: ['-u'],
    args: [recpath]
};

PythonShell.run('m2ts_starttime.py', options, function (err, results) {
	if (err) throw err;
  	generateAss(chlist[chname], results, endat);
});

	
function generateAss(channel, start_time, end_time) {
	var options = {
	    uri: "https://account.nicovideo.jp/api/v1/login?site=niconico",
	    headers: {
	        "Content-type": "application/x-www-form-urlencoded",
	    },
	    form: {
	        'mail': mail,
	        'password': password,
	    }
	};

	request.post(options, (error, response, body) => {
	    var cookieStr = '';
	    response.headers['set-cookie'].forEach(val => {
	        if (val.includes('deleted')) return;
	        cookieStr += val.split(';')[0] + '; '
	    })
	    const ass = getCommentAndAss(cookieStr, channel, start_time, end_time)
	    fs.writeFile(assfilename, ass, () => {});
	});
}

function getCommentAndAss(cookie, channel, start_time, end_time) {
    var chats = []
    var hash = new Set();
    for (let time = parseInt(start_time); time < parseInt(end_time); time += 60) {
        console.log(time)
        const command = `ruby ${jkCommentGetterPath} ${channel} ${time} ${time + 60} -i ${cookie}`
        const response = execSync(command).toString()
        if (response == "") continue;
        chatsXml = response.split('\n');
        chatsXml.forEach(chat => {
            if (chat == "") return;
            try {
                const date = chat.match('date="(.*?)"')[1];
                const usec = chat.match('date_usec="(.*?)"')[1];
                const content = chat.match('<chat.*?>(.*?)<\/chat>')[1];
                const time = parseFloat(`${date}.${usec}`);
                if (time < start_time || time > end_time) return;
                if (hash.has(time)) return;
                hash.add(time);
                chats.push({ time: time - start_time, text: content });
            }
            catch { return; }
        })
    }
    return buildAssFromChats(chats);
}

function buildAssFromChats(chats) {
    const assHeader = `[Script Info]\nScriptType: v4.00+\nCollisions: Normal\nScaledBorderAndShadow: Yes\nPlayResX: ${1920 * keisu}\nPlayResY: 1080\nTimer: 100.0000\nWrapStyle: 0\n\n` +
        '[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding' +
        '\nStyle: white,MS PGothic,28,&H00ffffff,&H00ffffff,&H00000000,&H00000000,-1,0,0,0,200,200,0,0.00,1,0,4,7,20,20,40,1\n\n' +
        '[Events]\nFormat: Layer, Start, End, Style, Actor, MarginL, MarginR, MarginV, Effect, Text\n';
    var assText = assHeader;
    chats.forEach(chat => {
        const height = getColumn() * 56;
        assText += `Dialogue: 0,${parseTime(chat.time)},${parseTime(chat.time + 8)},white,,0000,0000,0000,,` +
            `{\\move(${1920 * keisu},${height},-${eaw.length(chat.text) * 56},${height})}${chat.text}\n`
    })
    return assText;
}

function parseTime(unixtime) {
    const hour = Math.floor(unixtime / (60 * 60));
    const min = Math.floor((unixtime % (60 * 60)) / 60);
    const sec = Math.floor(unixtime % 60);
    const subsec = Math.floor((unixtime - Math.floor(unixtime)) * 100);
    return `${('0' + hour).slice(-1)}:${('00' + min).slice(-2)}:${('00' + sec).slice(-2)}.${('00' + subsec).slice(-2)}`
}

class Queue {
    constructor(size) {
        this.array = new Array(size);
        this.size = size;
        this.head = 0;
        this.tail = 0;
        this.length = 0;
    }

    push(o) {
        if (this.length >= this.size) return;
        this.array[this.tail] = o;
        this.tail = (this.tail + 1) % this.size;
        this.length++;
    }

    pop() {
        if (this.length <= 0) return null;
        const ret = this.array[this.head];
        this.head = (this.head + 1) % this.size;
        this.length--;
        return ret;
    }

    find(val) {
        for (let i = this.head; i < this.head + this.length; i++)
            if (this.array[i % this.size] == val) return true;
        return false;
    }
}

const que = new Queue(13)
function getColumn() {
    var value = Math.floor(Math.random() * 18);
    while (que.find(value))
        value = Math.floor(Math.random() * 18);
    if (que.length == que.size)
        que.pop();
    que.push(value);
    return value;
}
