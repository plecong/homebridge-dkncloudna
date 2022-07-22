/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

declare module "socket.io-client" {
  import { EventEmitter } from "events";
  /**
   * Looks up an existing `Manager` for multiplexing.
   * If the user summons:
   *
   *   `io('http://localhost/a');`
   *   `io('http://localhost/b');`
   *
   * We reuse the existing instance based on same scheme/port/host,
   * and we initialize sockets for each namespace.
   *
   * @api public
   */
  function lookup(uri: any, opts: any): any;
  namespace lookup {
    export { lookup as connect, Manager, Socket };
  }
  export = lookup;

  class Manager extends EventEmitter {
    /**
     * `Manager` constructor.
     *
     * @param {String} engine instance or engine uri/opts
     * @param {Object} options
     * @api public
     */
    constructor(uri: any, opts: any);
    nsps: {};
    subs: any[];
    opts: any;
    backoff: any;
    readyState: string;
    uri: any;
    connecting: any[];
    lastPing: Date;
    encoding: boolean;
    packetBuffer: any[];
    encoder: any;
    decoder: any;
    autoConnect: boolean;
    /**
     * Propagate given event to sockets and emit on `this`
     *
     * @api private
     */
    emitAll(...args: any[]): void;
    /**
     * Update `socket.id` of all sockets
     *
     * @api private
     */
    updateSocketIds(): void;
    /**
     * generate `socket.id` for the given `nsp`
     *
     * @param {String} nsp
     * @return {String}
     * @api private
     */
    generateId(nsp: string): string;
    /**
     * Sets the `reconnection` config.
     *
     * @param {Boolean} true/false if it should automatically reconnect
     * @return {Manager} self or value
     * @api public
     */
    reconnection(v: any, ...args: any[]): Manager;
    _reconnection: boolean;
    /**
     * Sets the reconnection attempts config.
     *
     * @param {Number} max reconnection attempts before giving up
     * @return {Manager} self or value
     * @api public
     */
    reconnectionAttempts(v: any, ...args: any[]): Manager;
    _reconnectionAttempts: any;
    /**
     * Sets the delay between reconnections.
     *
     * @param {Number} delay
     * @return {Manager} self or value
     * @api public
     */
    reconnectionDelay(v: any, ...args: any[]): Manager;
    _reconnectionDelay: any;
    randomizationFactor(v: any, ...args: any[]): any;
    _randomizationFactor: any;
    /**
     * Sets the maximum delay between reconnections.
     *
     * @param {Number} delay
     * @return {Manager} self or value
     * @api public
     */
    reconnectionDelayMax(v: any, ...args: any[]): Manager;
    _reconnectionDelayMax: any;
    /**
     * Sets the connection timeout. `false` to disable
     *
     * @return {Manager} self or value
     * @api public
     */
    timeout(v: any, ...args: any[]): Manager;
    _timeout: any;
    /**
     * Starts trying to reconnect if reconnection is enabled and we have not
     * started reconnecting yet
     *
     * @api private
     */
    maybeReconnectOnOpen(): void;
    /**
     * Sets the current transport `socket`.
     *
     * @param {Function} optional, callback
     * @return {Manager} self
     * @api public
     */
    open: (fn: any, opts: any) => Manager;
    connect(fn: any, opts: any): Manager;
    engine: any;
    skipReconnect: boolean;
    /**
     * Called upon transport open.
     *
     * @api private
     */
    onopen(): void;
    /**
     * Called upon a ping.
     *
     * @api private
     */
    onping(): void;
    /**
     * Called upon a packet.
     *
     * @api private
     */
    onpong(): void;
    /**
     * Called with data.
     *
     * @api private
     */
    ondata(data: any): void;
    /**
     * Called when parser fully decodes a packet.
     *
     * @api private
     */
    ondecoded(packet: any): void;
    /**
     * Called upon socket error.
     *
     * @api private
     */
    onerror(err: any): void;
    /**
     * Creates a new socket for the given `nsp`.
     *
     * @return {Socket}
     * @api public
     */
    socket(nsp: any, opts: any): Socket;
    /**
     * Called upon a socket close.
     *
     * @param {Socket} socket
     */
    destroy(socket: Socket): void;
    /**
     * Writes a packet.
     *
     * @param {Object} packet
     * @api private
     */
    packet(packet: any): void;
    /**
     * If packet buffer is non-empty, begins encoding the
     * next packet in line.
     *
     * @api private
     */
    processPacketQueue(): void;
    /**
     * Clean up transport subscriptions and packet buffer.
     *
     * @api private
     */
    cleanup(): void;
    /**
     * Close the current socket.
     *
     * @api private
     */
    close: () => void;
    disconnect(): void;
    reconnecting: boolean;
    /**
     * Called upon engine close.
     *
     * @api private
     */
    onclose(reason: any): void;
    /**
     * Attempt a reconnection.
     *
     * @api private
     */
    reconnect(): Manager;
    /**
     * Called upon successful reconnect.
     *
     * @api private
     */
    onreconnect(): void;
  }

  /**
   * `Socket` constructor.
   *
   * @api public
   */
  function Socket(io: any, nsp: any, opts: any): void;
  class Socket extends EventEmitter {
    /**
     * `Socket` constructor.
     *
     * @api public
     */
    constructor(io: any, nsp: any, opts: any);
    io: any;
    nsp: any;
    json: Socket;
    ids: number;
    acks: {};
    receiveBuffer: any[];
    sendBuffer: any[];
    connected: boolean;
    disconnected: boolean;
    flags: {};
    query: any;
    /**
     * Subscribe to open, close and packet events
     *
     * @api private
     */
    subEvents(): void;
    subs: {
      destroy: () => void;
    }[];
    /**
     * "Opens" the socket.
     *
     * @api public
     */
    open: () => Socket;
    connect(): Socket;
    /**
     * Sends a `message` event.
     *
     * @return {Socket} self
     * @api public
     */
    send(...args: any[]): Socket;
    /**
     * Override `emit`.
     * If the event is in `events`, it's emitted normally.
     *
     * @param {String} event name
     * @return {Socket} self
     * @api public
     */
    emit(ev: any, ...args: any[]): Socket;
    /**
     * Sends a packet.
     *
     * @param {Object} packet
     * @api private
     */
    packet(packet: any): void;
    /**
     * Called upon engine `open`.
     *
     * @api private
     */
    onopen(): void;
    /**
     * Called upon engine `close`.
     *
     * @param {String} reason
     * @api private
     */
    onclose(reason: string): void;
    /**
     * Called with socket packet.
     *
     * @param {Object} packet
     * @api private
     */
    onpacket(packet: any): void;
    /**
     * Called upon a server event.
     *
     * @param {Object} packet
     * @api private
     */
    onevent(packet: any): void;
    /**
     * Produces an ack callback to emit with an event.
     *
     * @api private
     */
    ack(id: any): (...args: any[]) => void;
    /**
     * Called upon a server acknowlegement.
     *
     * @param {Object} packet
     * @api private
     */
    onack(packet: any): void;
    /**
     * Called upon server connect.
     *
     * @api private
     */
    onconnect(): void;
    /**
     * Emit buffered events (received and emitted).
     *
     * @api private
     */
    emitBuffered(): void;
    /**
     * Called upon server disconnect.
     *
     * @api private
     */
    ondisconnect(): void;
    /**
     * Called upon forced client/server side disconnections,
     * this method ensures the manager stops tracking us and
     * that reconnections don't get triggered for this.
     *
     * @api private.
     */
    destroy(): void;
    /**
     * Disconnects the socket manually.
     *
     * @return {Socket} self
     * @api public
     */
    close: () => Socket;
    disconnect(): Socket;
    /**
     * Sets the compress flag.
     *
     * @param {Boolean} if `true`, compresses the sending data
     * @return {Socket} self
     * @api public
     */
    compress(compress: any): Socket;
    /**
     * Sets the binary flag
     *
     * @param {Boolean} whether the emitted data contains binary
     * @return {Socket} self
     * @api public
     */
    binary(binary: any): Socket;
  }
}
