// Copyright (c) 2020, Brandon Lehmann
//
// Please see the included LICENSE file for more information.

import {Socket} from 'net';
import {EventEmitter} from 'events';
import {format} from 'util';
import {ResponseArguments} from './ResponseArguments';
import {Logger} from "./Logger";

/** @ignore */
enum ContextState {
    INIT = 0,
    WAITING = 2,
}

/**
 * Represents the current channel state
 */
export enum ChannelState {
    DOWN_AVAILABLE = 0,
    DOWN_RESERVED,
    OFF_HOOK,
    DIGITS_DIALED,
    RINGING,
    REMOTE_RINGING,
    UP,
    BUSY,
}

/**
 * Represents the result of a Dial() attempt
 */
export enum DialStatus {
    ANSWER,
    BUSY,
    NOANSWER,
    CANCEL,
    CONGESTION,
    CHANUNAVAIL,
    DONTCALL,
    TORTURE,
    INVALIDARGS,
}

/**
 * Represents the playback status
 */
export enum PlaybackStatus {
    SUCCESS,
    USER_STOPPED,
    REMOTE_STOPPED,
    ERROR,
}

/** @ignore */
interface IResponse {
    code: number;
    result: number;
    arguments: ResponseArguments;
}

/**
 * Represents an AGI Channel
 */
export class Channel extends EventEmitter {

    private readonly m_connection: Socket;
    private m_state: ContextState;
    private m_message: string = '';
    private m_network: string = '';
    private m_network_script: string = '';
    private m_request: string = '';
    private m_channel: string = '';
    private m_language: string = '';
    private m_type: string = '';
    private m_uniqueid: string = '';
    private m_version: string = '';
    private m_callerid: string = '';
    private m_calleridname: string = '';
    private m_callingpres: string = '';
    private m_callingani2: string = '';
    private m_callington: string = '';
    private m_callingtns: string = '';
    private m_dnid: string = '';
    private m_rdnis: string = '';
    private m_context: string = '';
    private m_extension: string = '';
    private m_priority: string = '';
    private m_enhanced: string = '';
    private m_accountcode: string = '';
    private m_threadid: string = '';
    private arg_1: string = '';
    private arg_2: string = '';
    private arg_3: string = '';

    private logger: Logger | undefined;

    public isHangup: boolean = false;


    /**
     * Creates a new instance of a channel object
     * @param connection the AGI socket connection
     * @param logger
     */
    constructor(connection: Socket, logger?: Logger) {
        super();
        this.setMaxListeners(10);

        this.m_connection = connection;
        this.m_state = ContextState.INIT;

        this.m_connection.on('data', (data) => this.read(data));
        this.m_connection.on('close', () => this.emit('close'));
        this.m_connection.on('error', (error) => this.emit('error', error));
        this.m_connection.on('timeout', () => this.emit('timeout'));

        this.logger = logger;

        const hangupCallback = () => {
            this.isHangup = true;
            this.removeListener('hangup', hangupCallback);
        };
        this.on('hangup', hangupCallback);
    }

    /**
     * Event that is emitted when the underlying socket encounters an error
     * @param event
     * @param listener
     */
    public on(event: 'error', listener: (error: any) => void): this;

    /**
     * Event that is emitted when the underlying socket is closed
     * @param event
     * @param listener
     */
    public on(event: 'close', listener: () => void): this;

    /**
     * Event that emitted when the underlying socket times out
     * @param event
     * @param listener
     */
    public on(event: 'timeout', listener: () => void): this;

    /**
     * Event that is emitted when the channel is ready
     * @param event
     * @param listener
     */
    public on(event: 'ready', listener: () => void): this;

    /**
     * Event that is emitted when a response is received from the Asterisk server
     * @param event
     * @param listener
     */
    public on(event: 'recv', listener: (response: string) => void): this;

    /**
     * Event that emitted when the channel is hung up
     * @param event
     * @param listener
     */
    public on(event: 'hangup', listener: () => void): this;

    /**
     * Event that emitted when the response from the Asterisk server is processed into a structured response
     * @param event
     * @param listener
     */
    public on(event: 'response', listener: (response: IResponse) => void): this;

    /**
     * Event that is emitted when data is sent to the Asterisk server
     * @param event
     * @param listener
     */
    public on(event: 'send', listener: (data: string) => void): this;

    public on(event: any, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    /**
     * Whether this AGI request is over the network
     */
    public get network(): boolean {
        return (this.m_network.toLowerCase() === 'yes');
    }

    /**
     * The network path included in the AGI request
     * ie. agi://127.0.0.1:3000/test
     * This value would return 'test'
     */
    public get network_script(): string {
        return this.m_network_script;
    }

    /**
     * The version of Asterisk
     */
    public get version(): string {
        return this.m_version;
    }

    /**
     * The filename of your script
     * ie. agi
     */
    public get request(): string {
        return this.m_request;
    }

    /**
     * The originating channel (your phone)
     */
    public get channel(): string {
        return this.m_channel;
    }

    /**
     * The language code (e.g. “en”)
     */
    public get language(): string {
        return this.m_language;
    }

    /**
     * The originating channel type (e.g. “SIP” or “ZAP”)
     */
    public get type(): string {
        return this.m_type;
    }

    /**
     * A unique ID for the call
     */
    public get uniqueid(): string {
        return this.m_uniqueid;
    }

    /**
     * The caller ID number (or “unknown”)
     */
    public get callerid(): string {
        return this.m_callerid;
    }

    /**
     * The caller ID name (or “unknown”)
     */
    public get calleridname(): string {
        return this.m_calleridname;
    }

    /**
     * The presentation for the callerid in a ZAP channel
     */
    public get callingpres(): string {
        return this.m_callingpres;
    }

    /**
     * The number which is defined in ANI2 see Asterisk Detailed Variable List (only for PRI Channels)
     */
    public get callingani2(): string {
        return this.m_callingani2;
    }

    /**
     *  The type of number used in PRI Channels see Asterisk Detailed Variable List
     */
    public get callington(): string {
        return this.m_callington;
    }

    /**
     * An optional 4 digit number (Transit Network Selector) used in PRI Channels see Asterisk Detailed Variable List
     */
    public get callingtns(): string {
        return this.m_callingtns;
    }

    /**
     * The dialed number id (or “unknown”)
     */
    public get dnid(): string {
        return this.m_dnid;
    }

    /**
     * The referring DNIS number (or “unknown”)
     */
    public get rdnis(): string {
        return this.m_rdnis;
    }

    /**
     * Origin context in extensions.conf
     */
    public get context(): string {
        return this.m_context;
    }

    /**
     * The called number
     */
    public get extension(): string {
        return this.m_extension;
    }

    /**
     * The priority it was executed as in the dial plan
     */
    public get priority(): string {
        return this.m_priority;
    }

    /**
     * The flag value is 1.0 if started as an EAGI script, 0.0 otherwise
     */
    public get enhanced(): string {
        return this.m_enhanced;
    }

    /**
     * Account code of the origin channel
     */
    public get accountcode(): string {
        return this.m_accountcode;
    }

    /**
     * Thread ID of the AGI script
     */
    public get threadid(): string {
        return this.m_threadid;
    }

    /**
     * Get AGI argument 1
     */
    public get arg1(): string {
        return this.arg_1;
    }

    /**
     * Get AGI argument 2
     */
    public get arg2(): string {
        return this.arg_2;
    }

    /**
     * Get AGI argument 3
     */
    public get arg3(): string {
        return this.arg_3;
    }

    /**
     * Answers channel if not already in answer state.
     */
    public async answer(): Promise<void> {
        const response = await this.sendCommand('ANSWER');

        if (response.code !== 200 || response.result !== 0) {
            throw new Error('Could not answer call');
        }
    }

    /**
     * Interrupts expected flow of Async AGI commands and returns control to
     * previous source (typically, the PBX dialplan).
     */
    public async break(): Promise<void> {
        const response = await this.sendCommand('ASYNCAGI BREAK');

        if (response.code !== 200 || response.result !== 0) {
            throw new Error('Could not interrupt processing');
        }

        return this.close();
    }

    /**
     * Returns status of the connected channel.
     * @param channel
     */
    public async channelStatus(
        channel?: string,
    ): Promise<ChannelState> {
        const response = await this.sendCommand(format('CHANNEL STATUS %s',
            channel || '',
        ));

        if (response.code !== 200 || response.result === -1) {
            throw new Error('Could not get channel status');
        }

        return response.result;
    }

    /**
     * Sends audio file on channel and allows the listener to control the stream.
     * @param filename
     * @param escapeDigits
     * @param skipms
     * @param fastForwardCharacter
     * @param rewindCharacter
     * @param pauseCharacter
     */
    public async controlStreamFile(
        filename: string,
        escapeDigits: string = '',
        skipms?: number,
        fastForwardCharacter?: string,
        rewindCharacter?: string,
        pauseCharacter?: string,
    ): Promise<{ digit: string, playbackStatus: PlaybackStatus, playbackOffset: number }> {
        const response = await this.sendCommand(format('CONTROL STREAM FILE %s "%s" %s %s %s %s',
            filename,
            escapeDigits,
            skipms || '',
            fastForwardCharacter || '',
            rewindCharacter || '',
            pauseCharacter || '',
        ));

        if (response.code !== 200 || response.result === -1) {
            throw new Error('Could not control stream file');
        }

        const playbackStatus = await this.getVariable('CPLAYBACKSTATUS ');

        const playbackOffset = await this.getVariable('CPLAYBACKOFFSET ');

        let status: PlaybackStatus = PlaybackStatus.ERROR;

        switch (playbackStatus.toUpperCase()) {
            case 'SUCCESS':
                status = PlaybackStatus.SUCCESS;
                break;
            case 'USERSTOPPED':
                status = PlaybackStatus.USER_STOPPED;
                break;
            case 'REMOTESTOPPED':
                status = PlaybackStatus.REMOTE_STOPPED;
                break;
        }

        return {
            digit: response.arguments.char('result'),
            playbackStatus: status,
            playbackOffset: parseInt(playbackOffset, 10),
        };
    }

    /**
     * Attempts to establish a new outgoing connection on a channel, and then link it to the calling input channel.
     * @param target
     * @param timeout
     * @param params
     */
    public async dial(
        target: string,
        timeout: number = 30,
        params?: string,
    ): Promise<DialStatus> {
        await this.exec('Dial', format('%s,%s,%s',
            target,
            timeout,
            params || '',
        ));

        const dialstatus = await this.getVariable('DIALSTATUS');

        switch (dialstatus.toUpperCase()) {
            case 'ANSWER':
                return DialStatus.ANSWER;
            case 'BUSY':
                return DialStatus.BUSY;
            case 'NOANSWER':
                return DialStatus.NOANSWER;
            case 'CANCEL':
                return DialStatus.CANCEL;
            case 'CONGESTION':
                return DialStatus.CONGESTION;
            case 'CHANUNAVAIL':
                return DialStatus.CHANUNAVAIL;
            case 'DONTCALL':
                return DialStatus.DONTCALL;
            case 'TORTURE':
                return DialStatus.TORTURE;
            case 'INVALIDARGS':
                return DialStatus.INVALIDARGS;
            default:
                throw new Error('Unknown dial status');
        }
    }

    /**
     * Deletes an entry in the Asterisk database for a given family and key.
     * @param family
     * @param key
     */
    public async databaseDel(
        family: string,
        key: string,
    ): Promise<void> {
        const response = await this.sendCommand(format('DATABASE DEL %s %s',
            family,
            key,
        ));

        if (response.code !== 200 || response.result === 0) {
            throw new Error('Could not delete from the database');
        }
    }

    /**
     * Deletes a family or specific keytree within a family in the Asterisk database.
     * @param family
     * @param keyTree
     */
    public async databaseDelTree(
        family: string,
        keyTree?: string,
    ): Promise<boolean> {
        const response = await this.sendCommand(format('DATABASE DELTREE %s %s',
            family,
            keyTree || ''));

        if (response.code !== 200) {
            throw new Error('Could not delete tree from database');
        }

        return (response.result === 0);
    }

    /**
     * Retrieves an entry in the Asterisk database for a given family and key.
     * @param family
     * @param key
     */
    public async databaseGet(
        family: string,
        key: string,
    ): Promise<string> {
        const response = await this.sendCommand(format('DATABASE GET %s %s',
            family,
            key,
        ));

        if (response.code !== 200 || response.result === 0) {
            throw new Error('Database key not set');
        }

        return response.arguments.nokey();
    }

    /**
     * Adds or updates an entry in the Asterisk database for a given family, key, and value.
     * @param family
     * @param key
     * @param value
     */
    public async databasePut(
        family: string,
        key: string,
        value: string,
    ): Promise<string> {
        const response = await this.sendCommand(format('DATABASE PUT %s %s %s',
            family,
            key,
            value,
        ));

        if (response.code !== 200 || response.result === 0) {
            throw new Error('Database key not set');
        }

        return response.arguments.string('value');
    }

    /**
     * Executes application with given options
     * @param application.
     * @param args
     */
    public async exec(
        application: string,
        ...args: string[]
    ): Promise<number> {
        const response = await this.sendCommand(format('EXEC %s %s', application, args.join(' ')));

        if (response.code !== 200 || response.result === -2) {
            throw new Error('Could not execute application');
        }

        return response.result;
    }

    /**
     * Stream the given file, and receive DTMF data.
     * @param soundFile
     * @param timeout
     * @param maxDigits
     */
    public async getData(
        soundFile: string,
        timeout: number = 5,
        maxDigits?: number,
    ): Promise<{ digits: string, timeout: boolean }> {
        const response = await this.sendCommand(format('GET DATA %s %s %s',
            soundFile,
            timeout * 1000,
            maxDigits || '',
        ));

        if (response.code !== 200 || response.result === -1) {
            throw new Error('Could not get data from channel');
        }

        return {
            digits: response.arguments.string('result'),
            timeout: (response.arguments.string('value') === '(timeout)'),
        };
    }

    /**
     * Evaluates a channel expression
     * Understands complex variable names and builtin variables, unlike GET VARIABLE.
     * @param key
     * @param channel
     */
    public async getFullVariable(
        key: string,
        channel?: string,
    ): Promise<string> {
        const response = await this.sendCommand(format('GET FULL VARIABLE %s %s',
            key.toUpperCase(),
            channel || '',
        ));

        if (response.code !== 200 || response.result === 0) {
            throw new Error('Variable not set');
        }

        return response.arguments.nokey();
    }

    /**
     * Stream file, prompt for DTMF, with timeout.
     * Behaves similar to STREAM FILE but used with a timeout option.
     * @param soundFile
     * @param escapeDigits
     * @param timeout
     */
    public async getOption(
        soundFile: string,
        escapeDigits: string = '#',
        timeout: number = 5,
    ): Promise<{ digit: string, endpos: number }> {
        const response = await this.sendCommand(format('GET OPTION %s "%s" %s',
            soundFile,
            escapeDigits,
            timeout * 1000,
        ));

        if (response.code !== 200 || response.result === -1) {
            throw new Error('Could not get option');
        }

        if (response.arguments.number('endpos') === 0) {
            throw new Error('Could Not play file');
        }

        return {
            digit: response.arguments.char('result'),
            endpos: response.arguments.number('endpos'),
        };
    }

    /**
     * Gets a channel variable.
     * @param key
     */
    public async getVariable(
        key: string,
    ): Promise<string> {
        const response = await this.sendCommand(format('GET VARIABLE %s',
            key.toUpperCase(),
        ));

        if (response.code !== 200 || response.result === 0) {
            throw new Error('Variable not set');
        }

        return response.arguments.nokey();
    }

    /**
     * Cause the channel to execute the specified dialplan subroutine.
     * @param context
     * @param extension
     * @param priority
     * @param argument
     */
    public async goSub(
        context: string,
        extension: string,
        priority: number,
        argument?: string,
    ): Promise<void> {
        const response = await this.sendCommand(format('GOSUB %s %s %s %s',
            context,
            extension,
            priority,
            argument || '',
        ));

        if (response.code !== 200 || response.result !== 0) {
            throw new Error('Could not execute gosub');
        }
    }

    /**
     * Hangs up the specified channel. If no channel name is given, hangs up the current channel
     * @param channel
     */
    public async hangup(
        channel?: string,
    ): Promise<void> {
        const response = await this.sendCommand(format('HANGUP %s',
            channel || '',
        ));

        if (response.code !== 200 || response.result !== 1) {
            throw new Error('Could not hang up call');
        }

        this.isHangup = true;
    }

    /**
     * Does nothing
     */
    public async noop(): Promise<void> {
        const response = await this.sendCommand('NOOP');

        if (response.code !== 200 || response.result !== 0) {
            throw new Error('Could not NOOP');
        }
    }

    /**
     * Receives one character from channels supporting it.
     * @param timeout
     */
    public async receiveChar(
        timeout: number = 5,
    ): Promise<{ char: string, timeout: boolean }> {
        const response = await this.sendCommand(format('RECEIVE CHAR %s',
            timeout * 1000,
        ));

        if (response.code !== 200 || response.result === -1) {
            throw new Error('Could not get data from channel');
        }

        return {
            char: response.arguments.char('result'),
            timeout: response.arguments.boolean('timeout'),
        };
    }

    /**
     * Receives text from channels supporting it.
     * @param timeout
     */
    public async receiveText(
        timeout: number = 5,
    ): Promise<string> {
        const response = await this.sendCommand(format('RECEIVE TEXT %s',
            timeout * 1000,
        ));

        if (response.code !== 200 || response.result === -1) {
            throw new Error('Could not get data from channel');
        }

        return response.arguments.string('result');
    }

    /**
     * Records to a given file.
     * @param filename
     * @param fileFormat
     * @param escapeDigits
     * @param timeout
     * @param beep
     * @param silence
     * @param offsetSamples
     */
    public async recordFile(
        filename: string,
        fileFormat: string = 'gsm',
        escapeDigits: string = '#',
        timeout: number = 10,
        beep?: boolean,
        silence?: number,
        offsetSamples?: number,
    ): Promise<{ digit: string, endpos: number, timeout: boolean }> {
        const response = await this.sendCommand(format('RECORD FILE %s %s "%s" %s %s %s %s',
            filename,
            fileFormat,
            escapeDigits,
            timeout * 1000,
            offsetSamples || '',
            (beep) ? 'BEEP' : '',
            (silence) ? format('s=%s', silence) : '',
        ));

        if (response.code !== 200 || response.result === -1) {
            throw new Error('Could not record file');
        }

        return {
            digit: response.arguments.char('result'),
            endpos: response.arguments.number('endpos'),
            timeout: response.arguments.boolean('timeout'),
        };
    }

    /**
     * Says a given character string.
     * @param value
     * @param escapeDigits
     */
    public async sayAlpha(
        value: string,
        escapeDigits: string = '#',
    ): Promise<string> {
        const response = await this.sendCommand(format('SAY ALPHA %s "%s"',
            value,
            escapeDigits,
        ));

        if (response.code !== 200 || response.result === -1) {
            throw new Error('Could not say alpha');
        }

        return response.arguments.char('result');
    }

    /**
     * Says a given date.
     * @param value
     * @param escapeDigits
     */
    public async sayDate(
        value: Date | number,
        escapeDigits: string = '#',
    ): Promise<string> {
        const response = await this.sendCommand(format('SAY DATE %s "%s"',
            (typeof value === 'number') ? value : Math.floor(value.getTime() / 1000),
            escapeDigits,
        ));

        if (response.code !== 200 || response.result === -1) {
            throw new Error('Could not say date');
        }

        return response.arguments.char('result');
    }

    /**
     * Says a given time as specified by the format given.
     * @param value
     * @param escapeDigits
     * @param dateFormat
     * @param timezone
     */
    public async sayDateTime(
        value: Date | number,
        escapeDigits: string = '#',
        dateFormat?: string,
        timezone?: string,
    ): Promise<string> {
        const response = await this.sendCommand(format('SAY DATETIME %s "%s" %s %s',
            (typeof value === 'number') ? value : Math.floor(value.getTime() / 1000),
            escapeDigits,
            dateFormat || '',
            timezone || '',
        ));

        if (response.code !== 200 || response.result === -1) {
            throw new Error('Could not say date time');
        }

        return response.arguments.char('result');
    }

    /**
     * Says a given digit string.
     * @param value
     * @param escapeDigits
     */
    public async sayDigits(
        value: string,
        escapeDigits: string = '#',
    ): Promise<string> {
        const response = await this.sendCommand(format('SAY DIGITS %s "%s"',
            value,
            escapeDigits,
        ));

        if (response.code !== 200 || response.result === -1) {
            throw new Error('Could not say digits');
        }

        return response.arguments.char('result');
    }

    /**
     * Says a given number.
     * @param value
     * @param escapeDigits
     */
    public async sayNumber(
        value: number,
        escapeDigits: string = '#',
    ): Promise<string> {
        const response = await this.sendCommand(format('SAY NUMBER %s "%s"',
            value,
            escapeDigits,
        ));

        if (response.code !== 200 || response.result === -1) {
            throw new Error('Could not say number');
        }

        return response.arguments.char('result');
    }

    /**
     * Says a given character string with phonetics.
     * @param value
     * @param escapeDigits
     */
    public async sayPhonetic(
        value: string,
        escapeDigits: string = '#',
    ): Promise<string> {
        const response = await this.sendCommand(format('SAY PHONETIC %s "%s"',
            value,
            escapeDigits,
        ));

        if (response.code !== 200 || response.result === -1) {
            throw new Error('Could not say phonetic');
        }

        return response.arguments.char('result');
    }

    /**
     * Says a given time.
     * @param value
     * @param escapeDigits
     */
    public async sayTime(
        value: Date | number,
        escapeDigits: string = '#',
    ): Promise<string> {
        const response = await this.sendCommand(format('SAY TIME %s "%s"',
            (typeof value === 'number') ? value : Math.floor(value.getTime() / 1000),
            escapeDigits,
        ));

        if (response.code !== 200 || response.result === -1) {
            throw new Error('Could not say time');
        }

        return response.arguments.char('result');
    }

    /**
     * Sends images to channels supporting it.
     * @param image
     */
    public async sendImage(
        image: string,
    ): Promise<void> {
        const response = await this.sendCommand(format('SEND IMAGE %s',
            image,
        ));

        if (response.code !== 200 || response.result !== 0) {
            throw new Error('Could not send image');
        }
    }

    /**
     * Sends text to channels supporting it.
     * @param text
     */
    public async sendText(
        text: string,
    ): Promise<void> {
        const response = await this.sendCommand(format('SEND TEXT "%s"',
            text,
        ));

        if (response.code !== 200 || response.result !== 0) {
            throw new Error('Could not send text');
        }
    }

    /**
     * Autohangup channel in some time.
     * @param timeout
     */
    public async setAutoHangup(
        timeout: number = 60,
    ): Promise<void> {
        const response = await this.sendCommand(format('SET AUTOHANGUP %s',
            timeout,
        ));

        if (response.code !== 200 || response.result !== 0) {
            throw new Error('Could not set auto hangup');
        }
    }

    /**
     * Sets callerid for the current channel.
     * @param callerNumber
     * @param callerName
     */
    public async setCallerID(
        callerNumber: number,
        callerName?: string,
    ): Promise<void> {
        const callerid = (callerName) ?
            format('"%s"<%s>', callerName, callerNumber) :
            callerNumber;

        const response = await this.sendCommand(format('SET CALLERID %s',
            callerid,
        ));

        if (response.code !== 200 || response.result !== 1) {
            throw new Error('Could not set caller id');
        }
    }

    /**
     * Sets channel context.
     * @param context
     */
    public async setContext(
        context: string,
    ): Promise<void> {
        const response = await this.sendCommand(format('SET CONTEXT %s',
            context,
        ));

        if (response.code !== 200 || response.result !== 0) {
            throw new Error('Could not set context');
        }
    }

    /**
     * Changes channel extension.
     * @param extension
     */
    public async setExtension(
        extension: string,
    ): Promise<void> {
        const response = await this.sendCommand(format('SET EXTENSION %s',
            extension,
        ));

        if (response.code !== 200 || response.result !== 0) {
            throw new Error('Could not set extension');
        }
    }

    /**
     * Enable/Disable Music on hold generator
     * @param status
     * @param musicClass
     */
    public async setMusic(
        status: boolean = true,
        musicClass?: string,
    ): Promise<void> {
        const response = await this.sendCommand(format('SET MUSIC %s %s',
            (status) ? 'ON' : 'OFF',
            musicClass || '',
        ));

        if (response.code !== 200 || response.result !== 0) {
            throw new Error('Could not set priority');
        }
    }

    /**
     * Set channel dialplan priority.
     * @param priority
     */
    public async setPriority(
        priority: number,
    ): Promise<void> {
        const response = await this.sendCommand(format('SET PRIORITY %s',
            priority,
        ));

        if (response.code !== 200 || response.result !== 0) {
            throw new Error('Could not set priority');
        }
    }

    /**
     * Set channel dialplan priority.
     * @param key
     * @param value
     */
    public async setVariable(
        key: string,
        value: string,
    ): Promise<void> {
        const response = await this.sendCommand(format('SET VARIABLE %s "%s"',
            key.toUpperCase(),
            value,
        ));

        if (response.code !== 200 || response.result !== 1) {
            throw new Error('Could not set variable');
        }
    }

    public async speechActivateGrammar(
        grammar: string,
    ): Promise<IResponse> {
        // TODO: Handle the response
        return this.sendCommand(format('SPEECH ACTIVATE GRAMMAR %s',
            grammar,
        ));
    }

    public async speechCreate(
        engine: string,
    ): Promise<IResponse> {
        // TODO: Handle the response
        return this.sendCommand(format('SPEECH CREATE ENGINE %s',
            engine,
        ));
    }

    public async speechDeactivateGrammar(
        grammar: string,
    ): Promise<IResponse> {
        // TODO: Handle the response
        return this.sendCommand(format('SPEECH DEACTIVATE GRAMMAR %s',
            grammar,
        ));
    }

    public async speechDestroy(): Promise<IResponse> {
        // TODO: Handle the response
        return this.sendCommand('SPEECH DESTROY');
    }

    public async speechLoadGrammar(
        grammar: string,
        path: string,
    ): Promise<IResponse> {
        // TODO: Handle the response
        return this.sendCommand(format('SPEECH LOAD GRAMMAR %s %s',
            grammar,
            path,
        ));
    }

    public async speechRecognize(
        soundFile: string,
        timeout: number = 5,
        offset: number,
    ): Promise<IResponse> {
        // TODO: Handle the response
        return this.sendCommand(format('SPEECH RECOGNIZE %s %s %s',
            soundFile,
            timeout * 1000,
            offset,
        ));
    }

    public async speechSet(
        key: string,
        value: string,
    ): Promise<IResponse> {
        // TODO: Handle the response
        return this.sendCommand(format('SPEECH SET %s %s',
            key,
            value,
        ));
    }

    public async speedUnloadGrammar(
        grammar: string,
    ): Promise<IResponse> {
        // TODO: Handle the response
        return this.sendCommand(format('SPEECH UNLOAD GRAMMAR %s',
            grammar,
        ));
    }

    /**
     * Sends audio file on channel.
     * @param filename
     * @param escapeDigits
     * @param offset
     */
    public async streamFile(
        filename: string,
        escapeDigits: string = '#',
        offset?: number,
    ): Promise<{ digit: string, endpos: number }> {
        const response = await this.sendCommand(format('STREAM FILE %s "%s" %s',
            filename,
            escapeDigits,
            offset || '',
        ));

        if (response.code !== 200 || response.result === -1) {
            throw new Error('Could not stream file');
        }

        const status = await this.getVariable('PLAYBACKSTATUS ');

        if (status.toUpperCase() !== 'SUCCESS') {
            throw new Error('Could not stream file');
        }

        return {
            digit: response.arguments.char('result'),
            endpos: response.arguments.number('endpos'),
        };
    }

    /**
     * Toggles TDD mode (for the deaf).
     * @param status
     */
    public async tddMode(
        status: boolean,
    ): Promise<void> {
        const response = await this.sendCommand(format('TDD MODE %s',
            (status) ? 'ON' : 'OFF',
        ));

        if (response.code !== 200 || response.result !== 1) {
            throw new Error('Could not set TDD mode');
        }
    }

    /**
     * Logs a message to the asterisk verbose log.
     * @param message
     * @param level
     */
    public async verbose(
        message: string,
        level?: number,
    ): Promise<void> {
        const response = await this.sendCommand(format('VERBOSE "%s" %s',
            message,
            level || '',
        ));

        if (response.code !== 200 || response.result !== 1) {
            throw new Error('Could not send logging message');
        }
    }

    /**
     * Waits for a digit to be pressed.
     * @param timeout
     */
    public async waitForDigit(
        timeout: number = 5,
    ): Promise<string> {
        const response = await this.sendCommand(format('WAIT FOR DIGIT %s',
            timeout * 1000,
        ));

        if (response.code !== 200 || response.result === -1) {
            throw new Error('Could not wait for digit');
        }

        return response.arguments.char('result');
    }

    public close() {
        this?.logger?.debug({message: 'Closing AGI connection'});
        this.m_connection.destroy();
    }

    /* Internal Methods */

    private read(data: Buffer): void {
        if (data.length === 0) {
            return;
        }

        this.m_message += data.toString();

        if (this.m_state === ContextState.INIT) {
            if (this.m_message.indexOf('\n\n') === -1) {
                return;
            }

            this.readVariables(this.m_message);
        } else if (this.m_state === ContextState.WAITING) {
            if (this.m_message.indexOf('\n') === -1) {
                return;
            }

            this.readResponse(this.m_message);
        }

        this.m_message = '';
    }

    private readVariables(message: string) {
        const lines = message.split('\n');

        lines.map((line) => {
            const [key, ...rest] = line.split(':');
            const name: string = (key || '').trim();
            const value: string = (rest.join(':') || '').trim();

            const id = name.substring(4);

            switch (id) {
                case 'network':
                    return this.m_network = value;
                case 'network_script':
                    return this.m_network_script = value;
                case 'request':
                    return this.m_request = value;
                case 'channel':
                    return this.m_channel = value;
                case 'language':
                    return this.m_language = value;
                case 'type':
                    return this.m_type = value;
                case 'uniqueid':
                    return this.m_uniqueid = value;
                case 'version':
                    return this.m_version = value;
                case 'callerid':
                    return this.m_callerid = value;
                case 'calleridname':
                    return this.m_calleridname = value;
                case 'callingpres':
                    return this.m_callingpres = value;
                case 'callingani2':
                    return this.m_callingani2 = value;
                case 'callington':
                    return this.m_callington = value;
                case 'callingtns':
                    return this.m_callingtns = value;
                case 'dnid':
                    return this.m_dnid = value;
                case 'rdnis':
                    return this.m_rdnis = value;
                case 'context':
                    return this.m_context = value;
                case 'extension':
                    return this.m_extension = value;
                case 'priority':
                    return this.m_priority = value;
                case 'enhanced':
                    return this.m_enhanced = value;
                case 'accountcode':
                    return this.m_accountcode = value;
                case 'threadid':
                    return this.m_threadid = value;
                case 'arg_1':
                    return this.arg_1 = value;
                case 'arg_2':
                    return this.arg_2 = value;
                case 'arg_3':
                    return this.arg_3 = value;
            }
        });

        this.m_state = ContextState.WAITING;

        this.emit('ready');
    }

    private readResponse(message: string) {
        const lines = message.split('\n');

        lines.map((line) => this.readResponseLine(line));
    }

    private readResponseLine(line: string) {
        if (!line) {
            return;
        }

        this.logger?.debug({message: 'AGI recv', data: line});
        this.emit('recv', line);

        const parsed = line.split(' ');

        if (!parsed || parsed[0] === 'HANGUP') {
            return this.emit('hangup');
        }

        const code = parseInt(parsed[0], 10);
        parsed.shift();

        const args: ResponseArguments = new ResponseArguments();

        for (const value of parsed) {
            if (value.indexOf('=') !== -1) {
                const parts = value.split('=', 2);
                const key = parts[0].trim();
                const val = parts[1].trim();
                args.addArgument(key, val);
            } else if (value.indexOf('(') !== -1) {
                const name = value.substring(1, value.length - 1);
                args.addArgument(name, true);
            } else {
                args.addArgument('value', value);
            }
        }

        const response: IResponse = {
            code: code,
            result: args.number('result'),
            arguments: args,
        };

        this.emit('response', response);
    }

    private async send(message: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.emit('send', message);
            this.logger?.debug({message: 'AGI send', data: message});
            this.m_connection.write(message, (error) => {
                if (error) {
                    return reject(error);
                }
                return resolve();
            });
        });
    }

    private async sendCommand(command: string): Promise<IResponse> {
        return new Promise((resolve, reject) => {
            const responseListener = (response: IResponse) => {
                cleanup();
                resolve(response);
            };

            const socketClosedListener = () => {
                cleanup();
                reject(new Error('Socket was closed'));
            };

            const cleanup = () => {
                this.removeListener('response', responseListener);
                this.removeListener('close', socketClosedListener);
            };

            this.once('response', responseListener);
            this.once('close', socketClosedListener);

            this.send(format('%s\n',
                command.trim(),
            )).catch(error => {
                cleanup();
                reject(error);
            });
        });
    }
}
