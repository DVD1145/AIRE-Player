// AIRE-Player | GIF 89a frame decoder (omggif, (c) Dean McNamee, MIT)
/* GIF 89a decoder (omggif, (c) Dean McNamee, MIT): per-frame extraction for judge line GIF textures and gifEvents playback progress control */
"use strict";
function GifReader(buf) {
  var p = 0;
  if (buf[p++] !== 0x47 || buf[p++] !== 0x49 || buf[p++] !== 0x46 ||
      buf[p++] !== 0x38 || (buf[p++]+1 & 0xfd) !== 0x38 || buf[p++] !== 0x61) {
    throw new Error("Invalid GIF 87a/89a header.");
  }
  var width = buf[p++] | buf[p++] << 8;
  var height = buf[p++] | buf[p++] << 8;
  var pf0 = buf[p++];
  var global_palette_flag = pf0 >> 7;
  var num_global_colors_pow2 = pf0 & 0x7;
  var num_global_colors = 1 << (num_global_colors_pow2 + 1);
  buf[p++];
  buf[p++];
  var global_palette_offset = null;
  var global_palette_size   = null;
  if (global_palette_flag) {
    global_palette_offset = p;
    global_palette_size = num_global_colors;
    p += num_global_colors * 3;
  }
  var no_eof = true;
  var frames = [ ];
  var delay = 0;
  var transparent_index = null;
  var disposal = 0;
  var loop_count = null;
  this.width = width;
  this.height = height;
  while (no_eof && p < buf.length) {
    switch (buf[p++]) {
      case 0x21:
        switch (buf[p++]) {
          case 0xff:
            if (buf[p   ] !== 0x0b ||
                buf[p+1 ] == 0x4e && buf[p+2 ] == 0x45 && buf[p+3 ] == 0x54 &&
                buf[p+4 ] == 0x53 && buf[p+5 ] == 0x43 && buf[p+6 ] == 0x41 &&
                buf[p+7 ] == 0x50 && buf[p+8 ] == 0x45 && buf[p+9 ] == 0x32 &&
                buf[p+10] == 0x2e && buf[p+11] == 0x30 &&
                buf[p+12] == 0x03 && buf[p+13] == 0x01 && buf[p+16] == 0) {
              p += 14;
              loop_count = buf[p++] | buf[p++] << 8;
              p++;
            } else {
              p += 12;
              while (true) {
                var block_size = buf[p++];
                if (!(block_size >= 0)) throw Error("Invalid block size");
                if (block_size === 0) break;
                p += block_size;
              }
            }
            break;
          case 0xf9:
            if (buf[p++] !== 0x4 || buf[p+4] !== 0)
              throw new Error("Invalid graphics extension block.");
            var pf1 = buf[p++];
            delay = buf[p++] | buf[p++] << 8;
            transparent_index = buf[p++];
            if ((pf1 & 1) === 0) transparent_index = null;
            disposal = pf1 >> 2 & 0x7;
            p++;
            break;
          case 0xfe:
            while (true) {
              var block_size = buf[p++];
              if (!(block_size >= 0)) throw Error("Invalid block size");
              if (block_size === 0) break;
              p += block_size;
            }
            break;
          default:
            throw new Error("Unknown graphic control label: 0x" + buf[p-1].toString(16));
        }
        break;
      case 0x2c:
        var x = buf[p++] | buf[p++] << 8;
        var y = buf[p++] | buf[p++] << 8;
        var w = buf[p++] | buf[p++] << 8;
        var h = buf[p++] | buf[p++] << 8;
        var pf2 = buf[p++];
        var local_palette_flag = pf2 >> 7;
        var interlace_flag = pf2 >> 6 & 1;
        var num_local_colors_pow2 = pf2 & 0x7;
        var num_local_colors = 1 << (num_local_colors_pow2 + 1);
        var palette_offset = global_palette_offset;
        var palette_size = global_palette_size;
        var has_local_palette = false;
        if (local_palette_flag) {
          var has_local_palette = true;
          palette_offset = p;
          palette_size = num_local_colors;
          p += num_local_colors * 3;
        }
        var data_offset = p;
        p++;
        while (true) {
          var block_size = buf[p++];
          if (!(block_size >= 0)) throw Error("Invalid block size");
          if (block_size === 0) break;
          p += block_size;
        }
        frames.push({x: x, y: y, width: w, height: h,
                     has_local_palette: has_local_palette,
                     palette_offset: palette_offset,
                     palette_size: palette_size,
                     data_offset: data_offset,
                     data_length: p - data_offset,
                     transparent_index: transparent_index,
                     interlaced: !!interlace_flag,
                     delay: delay,
                     disposal: disposal});
        break;
      case 0x3b:
        no_eof = false;
        break;
      default:
        throw new Error("Unknown gif block: 0x" + buf[p-1].toString(16));
        break;
    }
  }
  this.numFrames = function() { return frames.length; };
  this.loopCount = function() { return loop_count; };
  this.frameInfo = function(frame_num) {
    if (frame_num < 0 || frame_num >= frames.length) throw new Error("Frame index out of range.");
    return frames[frame_num];
  }
  this.decodeAndBlitFrameRGBA = function(frame_num, pixels) {
    var frame = this.frameInfo(frame_num);
    var num_pixels = frame.width * frame.height;
    var index_stream = new Uint8Array(num_pixels);
    GifReaderLZWOutputIndexStream(buf, frame.data_offset, index_stream, num_pixels);
    var palette_offset = frame.palette_offset;
    var trans = frame.transparent_index;
    if (trans === null) trans = 256;
    var framewidth  = frame.width;
    var framestride = width - framewidth;
    var xleft       = framewidth;
    var opbeg = ((frame.y * width) + frame.x) * 4;
    var opend = ((frame.y + frame.height) * width + frame.x) * 4;
    var op    = opbeg;
    var scanstride = framestride * 4;
    if (frame.interlaced === true) scanstride += width * 4 * 7;
    var interlaceskip = 8;
    for (var i = 0, il = index_stream.length; i < il; ++i) {
      var index = index_stream[i];
      if (xleft === 0) {
        op += scanstride;
        xleft = framewidth;
        if (op >= opend) {
          scanstride = framestride * 4 + width * 4 * (interlaceskip-1);
          op = opbeg + (framewidth + framestride) * (interlaceskip << 1);
          interlaceskip >>= 1;
        }
      }
      if (index === trans) {
        op += 4;
      } else {
        var r = buf[palette_offset + index * 3];
        var g = buf[palette_offset + index * 3 + 1];
        var b = buf[palette_offset + index * 3 + 2];
        pixels[op++] = r;
        pixels[op++] = g;
        pixels[op++] = b;
        pixels[op++] = 255;
      }
      --xleft;
    }
  };
}
function GifReaderLZWOutputIndexStream(code_stream, p, output, output_length) {
  var min_code_size = code_stream[p++];
  var clear_code = 1 << min_code_size;
  var eoi_code = clear_code + 1;
  var next_code = eoi_code + 1;
  var cur_code_size = min_code_size + 1;
  var code_mask = (1 << cur_code_size) - 1;
  var cur_shift = 0;
  var cur = 0;
  var op = 0;
  var subblock_size = code_stream[p++];
  var code_table = new Int32Array(4096);
  var prev_code = null;
  while (true) {
    while (cur_shift < 16) {
      if (subblock_size === 0) break;
      cur |= code_stream[p++] << cur_shift;
      cur_shift += 8;
      if (subblock_size === 1) {
        subblock_size = code_stream[p++];
      } else {
        --subblock_size;
      }
    }
    if (cur_shift < cur_code_size) break;
    var code = cur & code_mask;
    cur >>= cur_code_size;
    cur_shift -= cur_code_size;
    if (code === clear_code) {
      next_code = eoi_code + 1;
      cur_code_size = min_code_size + 1;
      code_mask = (1 << cur_code_size) - 1;
      prev_code = null;
      continue;
    } else if (code === eoi_code) {
      break;
    }
    var chase_code = code < next_code ? code : prev_code;
    var chase_length = 0;
    var chase = chase_code;
    while (chase > clear_code) {
      chase = code_table[chase] >> 8;
      ++chase_length;
    }
    var k = chase;
    var op_end = op + chase_length + (chase_code !== code ? 1 : 0);
    if (op_end > output_length) {
      console.log("Warning, gif stream longer than expected.");
      return;
    }
    output[op++] = k;
    op += chase_length;
    var b = op;
    if (chase_code !== code) output[op++] = k;
    chase = chase_code;
    while (chase_length--) {
      chase = code_table[chase];
      output[--b] = chase & 0xff;
      chase >>= 8;
    }
    if (prev_code !== null && next_code < 4096) {
      code_table[next_code++] = prev_code << 8 | k;
      if (next_code >= code_mask+1 && cur_code_size < 12) {
        ++cur_code_size;
        code_mask = code_mask << 1 | 1;
      }
    }
    prev_code = code;
  }
  if (op !== output_length) {
    console.log("Warning, gif stream shorter than expected.");
  }
  return output;
}


