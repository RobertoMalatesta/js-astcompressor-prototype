'use strict';

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports'], factory);
  } else if (typeof exports !== 'undefined') {
    factory(exports);
  } else {
    factory((root.astDecoder = {}));
  }
}(this, function (exports) {
  var common = require("./ast-common.js");

  var NamedTable  = common.NamedTable,
      UniqueTable = common.UniqueTable,
      StringTable = common.StringTable,
      ObjectTable = common.ObjectTable;


  function ValueReader (bytes, index, count) {
    this.bytes        = bytes;
    this.byteReader   = encoding.makeByteReader(bytes, index, count);
    this.scratchBytes = new Uint8Array(128);
    this.scratchView  = new DataView(this.scratchBytes.buffer);
  }

  ValueReader.prototype.readByte = function () {
    return this.byteReader.read();
  };

  ValueReader.prototype.readBytes = function (buffer, offset, count) {
    if (arguments.length === 1) {
      var temp = new Uint8Array(buffer | 0);
      if (this.readBytes(temp, 0, buffer | 0))
        return temp;
      else
        return false;
    }

    for (var i = 0; i < count; i++) {
      var b = this.byteReader.read();

      if (b === false)
        return false;

      buffer[offset + i] = b;
    }

    return true;
  };

  ValueReader.prototype.readScratchBytes = function (count) {
    return this.readBytes(this.scratchBytes, 0, count);
  };

  ValueReader.prototype.readUint32 = function () {
    if (!this.readScratchBytes(4))
      return false;

    return this.scratchView.getUint32(0, true);
  };

  ValueReader.prototype.readInt32 = function () {
    if (!this.readScratchBytes(4))
      return false;

    return this.scratchView.getInt32(0, true);
  };

  ValueReader.prototype.readFloat64 = function () {
    if (!this.readScratchBytes(8))
      return false;

    return this.scratchView.getFloat64(0, true);
  };

  ValueReader.prototype.readUtf8String = function () {
    var length = this.readUint32();
    if (length === false)
      return false;

    if (length === 0)
      return "";

    var result = encoding.UTF8.decode(this.bytes, this.byteReader.get_position(), length);

    this.byteReader.skip(length);

    return result;
  };

  ValueReader.prototype.skip = function (distance) {
    this.byteReader.skip(distance);
  };


  function JsAstModule () {
    this.typeNames = null;
    this.strings   = null;
    this.arrays    = null;
    this.objects   = null;

    this.root_id   = null;
  };


  function deserializeArrayContents (reader, module, obj) {
    var bodySizeBytes = reader.readUint32();
    if (bodySizeBytes === false)
      throw new Error("Truncated file");

    reader.skip(bodySizeBytes);
  }


  function deserializeObjectContents (reader, module, obj) {
    var bodySizeBytes = reader.readUint32();
    if (bodySizeBytes === false)
      throw new Error("Truncated file");

    reader.skip(bodySizeBytes);
  }


  function deserializeTable (reader, payloadReader) {
    var count = reader.readUint32();
    if (count === false)
      throw new Error("Truncated file");

    var result = new Array(count);

    for (var i = 0; i < count; i++) {
      var item = payloadReader(reader);
      result[i] = item;
    }

    return result;
  };


  function deserializeArrays (reader, module) {
    var count = reader.readUint32();
    if (count === false)
      throw new Error("Truncated file");

    for (var i = 0; i < count; i++) {
      var arr = module.arrays[i];
      deserializeArrayContents(reader, module, arr);
    }    
  };


  function deserializeObjects (reader, module) {
    var count = reader.readUint32();
    if (count === false)
      throw new Error("Truncated file");

    for (var i = 0; i < count; i++) {
      var obj = module.objects[i];
      deserializeObjectContents(reader, module, obj);
    }    
  };


  function bytesToModule (bytes) {
    var reader = new ValueReader(bytes, 0, bytes.length);

    var magic = reader.readBytes(common.Magic.length);
    if (JSON.stringify(magic) !== JSON.stringify(common.Magic)) {
      throw new Error("Magic header does not match");
    }

    var formatName = reader.readUtf8String();
    if (formatName !== common.FormatName)
      throw new Error("Format name does not match");

    var rootIndex = reader.readUint32();

    // The lengths are stored in front of the tables themselves,
    //  this simplifies table deserialization...
    var typeNameCount = reader.readUint32();
    var stringCount   = reader.readUint32();
    var objectCount   = reader.readUint32();
    var arrayCount    = reader.readUint32();

    var result = new JsAstModule();
    var readUtf8String = function (reader) { 
      var text = reader.readUtf8String();
      if (text === false)
        throw new Error("Truncated file");
      return text;
    };
    var readDehydratedObject = function (reader) { 
      return new Object(); 
    };

    result.typeNames = deserializeTable(reader, readUtf8String);
    result.strings   = deserializeTable(reader, readUtf8String);

    // Pre-allocate the objects and arrays for given IDs
    //  so that we can reconstruct relationships in one pass.
    result.objects   = new Array(objectCount);
    for (var i = 0; i < objectCount; i++)
      result.objects[i] = new Object();

    result.arrays    = new Array(arrayCount);
    for (var i = 0; i < arrayCount; i++)
      // FIXME: This means we have to grow it when repopulating it. :-(
      result.arrays[i] = new Array();

    deserializeObjects(reader, result);
    deserializeArrays (reader, result);

    return result;
  };


  function moduleToAst (module) {
    console.log(module);
    throw new Error("Not implemented");
  };


  exports.ValueReader   = ValueReader;
  exports.bytesToModule = bytesToModule;
  exports.moduleToAst   = moduleToAst;
}));