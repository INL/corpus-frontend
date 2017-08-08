/*

Copyright 2017 Jan Niestadt.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

*/

var QSON = {};

(function () {

    /*
    TODO:
    - add option to ignore certain parameter names in query string
    */

    // What name to use for the query parameter if we call toQueryString with
    // a non-object value and no other name was specified.
    var DEFAULT_PARAM_NAME = "_";

    var QS_ENTRY_SEP   = "&";  // regular query string entry separator
    var QS_KEY_VAL_SEP = "=";  // regular query string key/value separator
    var START_COMPOUND = "(";  // start a QSON compound value (object or array)
    var END_COMPOUND   = ")";  // end of QSON compound value (object or array)
    var KEY_VAL_SEP    = "~";  // QSON key/value separator
    var ENTRY_SEP      = "'";  // QSON entry separator / "end of value" signal
    var FORCE_STRING   = "_";  // force value to be parsed as a string
    var ESCAPE         = "!";  // escape character, similar to \ in many languages

    // When parsing, only KEY_VAL_SEP, ENTRY_SEP and END_COMPOUND will end a 
    // key or value.
    var KEY_VAL_ENDING_CHARS = KEY_VAL_SEP + ENTRY_SEP + END_COMPOUND;

    // Escape START_COMPOUND and FORCE_STRING only if they're the first character,
    // because that's the only case where they can interfere with parsing.
    // (START_COMPOUND starts a list and FORCE_STRING indicates the value is explicitly a string)
    // KEY_VAL_ENDING_CHARS and ESCAPE must always be escaped in keys and values.
    var KEY_VAL_ESCAPE_REGEX = new RegExp("(^[" + START_COMPOUND + FORCE_STRING + "]|[" + KEY_VAL_ENDING_CHARS + ESCAPE + "])", "g");

    // Regex for also escaping newlines, tabs, etc. and any character above 127.
    var ESCAPE_LOW_ASCII_UNICODE_REGEX = /[\n\r\f\b\t\u0080-\uFFFF]/g;

    // Recognize 4 hexadecimal digits for Unicode escape sequences like !u00E9
    var UNICODE_HEX_REGEX = /^[0-9A-Fa-f]{4}$/;

    // What are definitely safe names for regular query parameters?
    // (call setAllowAnyQueryParameterName to allow any name)
    var QUERY_PARAMETER_NAME_REGEX = /^[a-zA-Z_][a-zA-Z_0-9\-\.]*$/;

    // Regex used to decide if a value should be parsed as a number
    var NUMBER_REGEX = /^[\-]?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;

    // Check if the input appears to be a number.
    function isNumberString(input) {
        return input && input.match(NUMBER_REGEX);
    }

    // By default, we're conservative in the query parameter names we allow.
    // Set this to true to allow any character in parameter names.
    var allowAnyQueryParameterName = false;

    // By default, we only escape characters that have special meaning in QSON.
    // Set this to true to also escape low ASCII chars (newline, tab, etc.)
    // and characters above 127 when creating QSON. This is useful if you want
    // to e.g. write a QSON value to a TSV file.
    var escapeLowAsciiAndUnicode = false;

    /**
     * Serialize the value to a QSON string. 
     * @param value value to serialize
     * @return QSON representation
     */
    QSON.stringify = function stringify(value) {

        function replaceLowAsciiAndUnicode(match) {
            switch (match) {
            case '\n': return "!n";
            case '\r': return "!r";
            case '\f': return "!f";
            case '\b': return "!b";
            case '\t': return "!t";
            default:   return "!u" + ("000" + match.charCodeAt(0).toString(16)).slice(-4);
            }
        }

        // Escape characters with special meaning in QSON with a !
        // (optionally also escapes low ascii and unicode chars)
        function escapeSpecialChars(str) {
            str = str.replace(KEY_VAL_ESCAPE_REGEX, ESCAPE + "$1");
            if (escapeLowAsciiAndUnicode) {
                str = str.replace(ESCAPE_LOW_ASCII_UNICODE_REGEX, replaceLowAsciiAndUnicode);
            }
            return str;
        }

        var output = [];
        if (Array.isArray(value)) {
            // Array. Join entries with ENTRY_SEP.
            var parts = [];
            for (var i = 0; i < value.length; i++) {
                parts.push(QSON.stringify(value[i]));
            }
            output.push(START_COMPOUND, parts.join(ENTRY_SEP), END_COMPOUND);
        } else if ((typeof value === "object") && (value !== null)) {
            // Object. Join key/value with KEY_VAL_SEP and entries with ENTRY_SEP.
            var parts = [];
            for (var key in value) {
                if (value.hasOwnProperty(key)) {
                    parts.push(escapeSpecialChars(key) + KEY_VAL_SEP + QSON.stringify(value[key]));
                }
            }
            if (parts.length > 0) {
                output.push(START_COMPOUND, parts.join(ENTRY_SEP), END_COMPOUND);
            } else {
                // Empty object has a special notation (to distinguish from empty array)
                output.push(START_COMPOUND, KEY_VAL_SEP, KEY_VAL_SEP, END_COMPOUND);
            }
        } else if (value === null) {
            output.push("null");
        } else if (typeof value === "boolean") {
            output.push(value ? "true" : "false");
        } else if (typeof value === "number") {
            output.push(String(value));
        } else {
            var str = String(value); // make sure it's a string
            if (str === "null" || str === "true" || str === "false" || isNumberString(str)) {
                return FORCE_STRING + str; // FORCE_STRING (_) means: parse this as a string even if it looks like a number, etc.
            }

            // String value. Escape QSON special characters.
            output.push(escapeSpecialChars(str));
        }
        return output.join("");
    }

    /**
     * Deserialize the input string to the original value.
     * @param input QSON string to deserialize
     * @return corresponding value
     */
    QSON.parse = function (input) {

        var pos = 0;

        function errorMsg(msg) {
            return msg + " at " + pos;
        }

        // Does the current character match this char?
        function accept(c) {
            if (pos >= input.length || input[pos] !== c)
                return false;
            pos++;
            return true;
        }

        // If the current character does not match this char, throw an error
        function expect(c) {
            if (!accept(c)) {
                if (pos >= input.length)
                    throw errorMsg("Expected " + c + ", found end of input");
                throw errorMsg("Expected " + c + ", found " + input[pos]);
            }
        }

        // string, number, boolean or null
        function simpleValue(isKey) {
            var str = [];
            var explicitString = false;
            if (!isKey) {
                if (accept(FORCE_STRING)) {
                    explicitString = true;
                }
            }
            while (pos < input.length && KEY_VAL_ENDING_CHARS.indexOf(input[pos]) < 0) {
                if (input[pos] === ESCAPE) {
                    if (pos === input.length - 1)
                        throw errorMsg("Input ends with escape character (" + ESCAPE + ")");
                    // Escape char, copy next char verbatim
                    pos++;
                    switch(input[pos]) {
                    case START_COMPOUND:  case END_COMPOUND:  case KEY_VAL_SEP: 
                    case ENTRY_SEP:       case FORCE_STRING:  case ESCAPE:
                        str.push(input[pos]); break;
                    case 't':  str.push('\t'); break;
                    case 'n':  str.push('\n'); break;
                    case 'r':  str.push('\r'); break;
                    case 'f':  str.push('\f'); break;
                    case 'b':  str.push('\b'); break;
                    case 'u':
                        // 4-digit hex Unicode codepoint follows
                        if (pos + 4 >= input.length)
                            throw errorMsg("Malformed unicode escape sequence: " + input);
                        var hexStr = input.substr(pos + 1, 4);
                        if (!hexStr.match(UNICODE_HEX_REGEX))
                            throw errorMsg("Malformed unicode escape sequence: " + input);
                        var codePoint = parseInt(hexStr, 16);
                        str.push(String.fromCharCode(codePoint));
                        pos += 4;
                        break;
                    default:
                        throw errorMsg("Illegal escape sequence !" + input[pos]);
                    }
                } else {
                    str.push(input[pos]);
                }
                pos++;
            }
            var result = str.join("");
            if (isKey)
                return { "value": result };
            if (explicitString) {
                // Either a key, which must always be a string, or a value starting with FORCE_STRING (_), meaning:
                // "explicitly interpret this as a string, even though it might look like a number, boolean, or null"
                return { "value": result, "from": FORCE_STRING + result };
            }
            if (!isKey) {
                if (result === "null")
                    return { "value": null, "from": result };
                if (result === "true")
                    return { "value": true, "from": result };
                if (result === "false")
                    return { "value": false, "from": result };
                if (isNumberString(result))
                    return { "value": Number(result), "from": result };
            }
            return { "value": result };
        }

        function object(firstKey) {
            var obj = {};
            if (firstKey.length === 0 && accept(KEY_VAL_SEP)) {
                // Empty object.
                return obj;
            }
            obj[firstKey] = value();
            while (accept(ENTRY_SEP)) {
                var k = simpleValue(true).value;
                expect(KEY_VAL_SEP);
                var v = value();
                obj[k] = v;
            }
            return obj;
        }

        function array(firstValue) {
            var arr = [firstValue];
            while (accept(ENTRY_SEP))
                arr.push(value());
            return arr;
        }

        function arrayOrObject() {
            var kv = keyOrValue();
            if (accept(KEY_VAL_SEP)) {
                // It's an object.

                // We read a value or key, and it turned out to be a key.
                // Make sure we use the original string as key, not the 
                // interpreted value (which may be bool, null, number, etc.)
                var key = kv.from ? kv.from : kv.value;

                // Pass in the first key.
                return object(key);
            }
            // It's an array. Pass in the first value.
            return array(kv.value);
        }

        function value() {
            return keyOrValue().value;
        }

        function keyOrValue() {
            var result;
            if (accept(START_COMPOUND)) {
                if (accept(END_COMPOUND)) {
                    // Empty list
                    result = [];
                } else {
                    // Array or object
                    result = arrayOrObject();
                    expect(END_COMPOUND);
                }
                result = {
                    "value": result
                };
            } else {
                result = simpleValue();
            }
            return result;
        }

        var result = value();
        if (pos < input.length && input[pos] !== ENTRY_SEP) // ENTRY_SEP doubles as "end of value"
            throw errorMsg("Premature end of value found");
        return result;
    }

    /** Convert the value to a query parameter object suitable for passing to e.g. jQuery.
     * 
     * @param value value to serialize
     * @param defaultParamName parameter name used if the value is not an object
     * @return Map of QSON-encoded parameters 
     */
    QSON.toParamObject = function toParamObject(value, defaultParamName) {
        var obj = {};
        if (defaultParamName === undefined || defaultParamName === null)
            defaultParamName = DEFAULT_PARAM_NAME;
        if (!Array.isArray(value) && (typeof value === "object") && (value !== null)) {
            // Top-level object. Encode as regular query string.
            for (var key in value) {
                if (value.hasOwnProperty(key)) {
                    var disallowKey = !allowAnyQueryParameterName && !key.match(QUERY_PARAMETER_NAME_REGEX);
                    if (key === defaultParamName || disallowKey)  {
                        // We found a key we can't use as a regular query parameter name
                        // (either not a valid name, or equal to default param name)
                        // Just use the default param name and stringify the whole value.
                        obj = {};
                        obj[defaultParamName] = QSON.stringify(value);
                        return obj;
                    }
                    obj[key] = QSON.stringify(value[key]);
                }
            }
        } else {
            // Top-level is not an object; return regular encoding.
            obj[defaultParamName] = QSON.stringify(value);
        }
        return obj;
    }

    /** Convert the value from a query parameter object back to the original value.
     * @param obj parameter object to decode
     * @param defaultParamName parameter name that was used if the value was not an object
     * @return decoded original value
     */
    QSON.fromParamObject = function fromParamObject(obj, defaultParamName) {
        var result = {};
        if (defaultParamName === undefined || defaultParamName === null)
            defaultParamName = DEFAULT_PARAM_NAME;
        var n = 0;
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                var value = QSON.parse(obj[key]);
                result[key] = value;
                n++;
            }
        }
        if (n === 1 && result.hasOwnProperty(defaultParamName))
            return result[defaultParamName];
        return result;
    }

    /** Convert the value to a query string that can be appended to a URL directly.
     * NOTE: the resulting query string does not start with a "?".
     * @param value value to convert to a query string
     * @param defaultParamName parameter name used if the value is not an object
     * @return QSON-encoded query string
     */
    QSON.toQueryString = function toQueryString(value, defaultParamName) {
        var param = QSON.toParamObject(value, defaultParamName);
        var parts = [];
        for (var key in param) {
            if (param.hasOwnProperty(key)) {
                parts.push(encodeURIComponent(key) + QS_KEY_VAL_SEP + encodeURIComponent(param[key]));
            }
        }
        return parts.join(QS_ENTRY_SEP);
    }

    /** Convert a query string back to the original value.
     * @param input query string to decode
     * @param defaultParamName parameter name used if the value is not an object
     * @param ignoreParams if specified, these parameter names will be ignored
     * @return decoded original value
     */
    QSON.fromQueryString = function fromQueryString(input, defaultParamName, ignoreParams) {
        if (input == null || input.length === 0) {
            // Empty object
            return {};
        }
        if (input[0] === '?')
            input = input.substr(1);
        var entries = input.split(/&/);
        var paramObj = {};
        for (var i = 0; i < entries.length; i++) {
            if (i === entries.length - 1 && entries[i].length === 0)
                break; // query string ended with &; this is okay
            var keyValue = entries[i].split(/=/);
            if (keyValue.length !== 2)
                throw "Malformed parameter in query string: " + input;
            var key = decodeURIComponent(keyValue[0]);
            if (key.length === 0)
                throw "Malformed parameter in query string: " + input;
            if (Array.isArray(ignoreParams) && ignoreParams.indexOf(key) >= 0)
                continue;
            var value = decodeURIComponent(keyValue[1]);
            paramObj[key] = value;
        }
        return QSON.fromParamObject(paramObj, defaultParamName);
    }

    /** Should any query parameter name be allowed?
     * 
     * By default, we're conservative in the query parameter names we allow.
     * Set this to true to allow any character in parameter names.
     * @param b whether or not to allow all query parameter names
     */
    QSON.setAllowAnyQueryParameterName = function setAllowAnyQueryParameterName(b) {
        allowAnyQueryParameterName = !!b;
    }

    /** Should we escape characters that don't have special meaning in QSON?
     *  
     * By default, we only escape characters that have special meaning in QSON.
     * Set this to true to also escape low ASCII chars (newline, tab, etc.)
     * and characters above 127 when creating QSON. This is useful if you want
     * to e.g. write a QSON value to a TSV file.
     * @param b whether or not to allow all query parameter names
     */
    QSON.setEscapeLowAsciiAndUnicode = function setEscapeLowAsciiAndUnicode(b) {
        escapeLowAsciiAndUnicode = !!b;
    }

})();
