var SINGLEPAGE = SINGLEPAGE || {}

SINGLEPAGE.CQLPARSER = (function() {

    var WHITESPACE = [' ', '\t', '\n', '\r'];

    function parse(input) {

        var pos = 0;
        var cur = '';

        function errorMsg(msg) {
            return msg + " at " + pos;
        }

        function nextSym() {
            if (++pos >= input.length)
                cur = null;
            else 
                cur = input[pos];
        }

        // Test current symbol against any number of other symbols
        // Recursively unpacks arrays
        function test() {
            for (var i = 0; i < arguments.length; i++) {
                var symbol = arguments[i];
                
                if (symbol instanceof Array) {
                    for (var j = 0; j < symbol.length; j++) {
                        if (test(symbol[j]))
                            return true;
                    }
                } else if (symbol === cur) {
                    return true;
                }
            }
            return false;
        }

        // If the current symbol matches any of the symbols, advance one symbol
        // skips all whitespace encountered before the symbol unless otherwise stated
        // no whitespace is skipped if the symbol was not encountered
        function accept(sym, keepWhitespace) {
            var originalPos = pos;
            var originalCur = cur;
           
            if (!keepWhitespace) {
                while (test(WHITESPACE))
                    nextSym();
            }
            
            var accepted = test(sym);
            if (accepted) {
                nextSym();

                if (!keepWhitespace) {
                    while (test(WHITESPACE))
                        nextSym();
                }
            } else {
                cur = originalCur;
                pos = originalPos;
            }

            return accepted;
        }

        // Like accept, but throw an error if not at any of the symbols.
        function expect(sym, keepWhitespace) {
            if (!accept(sym, keepWhitespace))
                throw errorMsg("Expected one of [" + sym + "] but found " + input[pos]);
        }

        // Continue until one of the symbols is encountered, 
        // then stop at the encountered symbol and return a substring from where we started and ending at that symbol (exclusive)
        function until(symbols) {
            try {
                var startPos = pos;
                while (!test(symbols, true))
                    nextSym();
                var endPos = pos;

                return input.substring(startPos, endPos);
            } catch(err) {
                // We can be a little more descriptive in our errors
                throw new errorMsg("Unexpected end of input, expected one of [" + symbols + "]");
            }
        }

        function parseXmlTag() {
            expect("<");

            var isClosingTag = accept("/");

            // keep going until we meet the end of the tag, also break on whitespac as it's not allowed
            var tagName = until([WHITESPACE, ">"]);
            expect(">");

            return {
                type: "xml", 
                name: tagName, // todo validate
                isClosingTag: isClosingTag
            };
        }

        function parseAttribute() {
            var name = until(["=", "!"]).trim();
            var operator = until('"').trim();
            expect('"');
            var test = until('"'); // don't trim whitespace
            expect('"');

            if (operator !== "=" && operator !== "!=")
                throw new errorMsg("Unknown operator " + operator);

            return {
                type: "attribute",
                attributeType: name,
                operator: operator,
                value: test
            }
        }

        function parsePredicate() {
            if (accept("(")) {
                var exp = parseExpression();
                expect(")");
                return exp;
            } else { 
                return parseAttribute();
            }
        }

        function parseExpression() {
            var left = parsePredicate();
            while (test(["&", "|"])) {
                var op = cur;
                nextSym();
                var right = parsePredicate();

                left = {
                    type: "binaryOp",
                    operator: op,
                    left: left,
                    right: right
                }
            }

            return left;
        }

        function parseToken() {
            
            var token = {
                leadingXmlTag: null,
                trailingXmlTag: null,

                expression: null,
                optional: false,
                repeats: null,
            };


            if (test("<")) {
                token.leadingXmlTag = parseXmlTag();
            }
            
            if (accept("[")) {

                token.expression = parseExpression();
                expect("]");    

            } else { // shorthand is just a single word
                expect('"');
                var word = until('"');
                expect('"');

                token.expression = {
                    type: "attribute",
                    attributeType: "word", // or whatever the default is
                    operator: "=",
                    value: word
                }
            }
            
            if (accept("{")) { // range
                
                var minRep = parseInt(until([",", "}"]));
                var maxRep = null;

                if (accept(",")) {
                    
                    var maxRepString = until("}").trim();
                    // {n, } is valid syntax for unbounded repetitions starting at n times
                    // signal this by leaving maxRep as null
                    if (maxRepString.length > 0) 
                        maxRep = parseInt(maxRepString);
                    
                    expect("}");
                }
                else {
                    maxRep = minRep;
                    expect("}");
                }
                
                if (isNaN(minRep))
                    throw new errorMsg("minRepeats is not a number");
                if (maxRep !== null && isNaN(maxRep))
                    throw new errorMsg("maxRepeats is not a number");
                 
                token.repeats = {
                    min: minRep,
                    max: maxRep,
                };
            }
            else if (accept("?")) {
                token.optional = true;
            }

            if (test("<")) {
                token.trailingXmlTag = parseXmlTag();
                if (!token.trailingXmlTag.isClosingTag)
                    throw new errorMsg("Token is followed by xml tag but it's an opening tag");
            }

            return token;
        }

        if (!input)
            return null;
        input = input.trim();
        if (!input)
            return null;

        pos = 0;
        cur = input[0];

        var tokens = [];

        while (pos < input.length)
            tokens.push(parseToken());
        
        return tokens;
    }

    return {
        parse: parse
    }
    
})();