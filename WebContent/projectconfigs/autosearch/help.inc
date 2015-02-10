<style>
p.spacer { height: 1cm; }
p.endspacer { height: 5cm; }
.internal { display: none; }
</style>

<h1>AutoSearch help</h2>

<p>(product-specific help information not available yet. Below is information how to search your corpora, taken from the <a href='http://chn.inl.nl/'>CHN</a>)</p>

<p class='spacer'><a name='help'></a>&nbsp;</p>
<h2>HELP</h2>
    <p>
        Accessing the contents of the <i>Corpus Hedendaags Nederlands</i> can be done via a simple search interface and via CQL. Searching this text material is possible because of the linguistic annotation with Part of Speech and Modern Lemma of each word in the text.
    </p>
    <h3>Simple Search</h3>
    <p>
        You can search for words matching one or more of the three properties: WORD FORM, LEMMA and  PART OF SPEECH. Use the search boxes on the top left of the website&#39;s home page.
    </p>
    <p>
        A <b>word form</b> is an occurrence of a word in the text.  By typing <i>wandelen</i> ('collection') in the word form search box, you will find the occurrences of <i>wandelen</i> in the collection.
    </p>
    <p>
        <i>Wandelen</i> is only one of the possible forms for <i>"wandelen"</i>. You can search for all forms by looking for the <b>lemma</b> <i>wandelen</i>, using the lemma search box. 
    </p>
    <p>
        It is also possible to search for words with a specific <b>Part of Speech</b> in the text. For example if you want to know which <i>adjectives</i> were used in the text, search for <i>AA*</i> in the <b>Part of Speech</b> search field.
    </p>
    <p>
        Combining features is possible when searching. If you are looking for the lemma <i>leven</i> as a verb ('to live'), type <i>leven</i> in the <b>Lemma search box</b> and <i>VRB*</i> in the <b>Part of Speech search box</b>. You will find all instances of the verb <i>leven</i>. For the occurences of the noun "leven", enter <i>NOU.*</i> in the part of speech box.
    </p>
    <p>
        Searching with a <b>* wildcard</b> is also possible. For example, in order to search for all words containing <i>lopen</i> ('walk'), you can do that by typing <i>*lopen*</i> in the lemma search box. Wildcard search is supported for WORDFORM, LEMMA and PART OF SPEECH searches. The <b>*</b> (asterisk) symbol matches <i>zero or more</i> characters.
    </p>
    <p>
        Searching for a <b>word group</b> is also possible by simply typing the word group in the search box. Typing <i>lief man</i> ('sweet husband/man') in the lemma search box will give you all occurrences of words with the lemma <i>lief</i> immediately followed by words with the lemma <i>man</i>. If you want to search for the combination <i>het leven</i> ('the life') where 'leven' is a noun, type the string <i>het leven</i> in the <b>lemma search box</b> and <i>PD* N*</i>  in the <b>Part of Speech search box</b>.
    </p>
    <p>
        The part of speech tagset is documented in the INL working paper <a href="http://www.inl.nl/images/stories/onderzoek_en_onderwijs/publicaties/TaalbankWorkingpaper3.pdf">De 
morfosyntactische 
module van het 
GiGaNT-lexicon</a>. 
        The list of main Part of Speech tags is:
        <ul>
        <li>AA*: adjective or adverb</li>
        <li>ADP*: preposition</li>
            <li>ADV*: adverb</li>
            <li>CONJ*: conjunction</li>
            <li>INT: interjection</li>
            <li>NOU-C*: common noun</li>
            <li>NOU-P*: common noun</li>
            <li>NUM: numeral</li>
            <li>PD*: pronoun, determiner, article</li>
            <li>RES*: residual categories (abbreviation, formula, symbol, truncated word, unknown)</li>
            <li>VRB*: verb</li>
            </ul>
        Search can be performed by clicking on SEARCH in the window or using ENTER on your keyboard. By clicking on RESET, all selections or information in search boxes will be cleared.
    </p>
    <h3>Filtering by metadata</h3>
    <p>
        All the above mentioned searches are performed on the complete corpus. If you want to search in a particular subset of the material, you can do that by using the metadata information accompanying each text in the collection.
    </p>
    <p>
        You can search by AUTHOR, TITLE, PUBLICATION YEAR and LANGUAGE VARIANT.
    </p>
    <p>
        To find texts from a specific time period, fill in "year from" and "year to". To find texts starting from a specific year, fill in "year from". To find text from a specific year, fill in that year in both "year from" and "year to" 
    </p>
    <p>
        To restrict your search to texts from either the Netherlands of from Belgium, use the Language variant dropdown list.
    </p>
    <h3>Search results</h3>
    Search results can be presented in four different ways: Per hit, Per document, Hits Grouped, Documents Grouped.
    <h4>Per Hit</h4>
    <p>
        Here the search results are presented in the form of concordances, an overview of every occurrence of the query word with x words of surrounding context. The word that is searched for (the hit), is shown in bold type and supplied with information on its lemma and part of speech.
    </p>
    <p>
        The number of concordances per page can be determined by choosing the number from the drop-down list after SHOW ME. The number of pages that can be displayed are presented above the concordances. By clicking on a number or on NEXT you can see the results of another page.
    </p>
    <p>
        To view the concordances with or without metadata, click on SHOW/HIDE TITLES.
    </p>
    <p>
        Clicking on a title is the way to view the complete document metadata. 
    </p>
    <p>
        By clicking on a concordance line, more context is presented.
    </p>
    <p>
        There are several ways in which you can change the order of the concordances.
    </p>
    <p>
        By clicking on LEFT CONTEXT and choosing "word" the concordances are sorted by ordering the word to the left of the hit text alphabetically. You can do the same for RIGHT CONTEXT. By clicking on HIT TEXT or LEMMA or PART OF SPEECH, Hits or Lemmas or PoS's are presented in alphabetical order. To go from ascending to descending alphabetical order or vice versa, simply click on the chosen item again.
    </p>
    <h4>Per Document</h4>
    <p>
        To have a better overview of the documents in which your search was successful, switch to the per-document view by clicking on PER DOCUMENT.
    </p>
    <p>
        The documents are listed, with one example accompanied by information on the date of the document and the total number of occurrences of the hit text in the document.
    </p>
    <p>
        The document metadata can be viewed by either clicking on the title or on VIEW DOCUMENT.
    </p>
    <p>
        There are several ways in which you can change the order of the documents.
    </p>
    <p>
        By clicking on DOCUMENT TITLE, the information is presented in alphabetical order. To go from ascending to descending alphabetical order or vice versa, simply click on DOCUMENT TITLE again.
    </p>
    <p>
        By clicking on YEAR, the documents are presented in chronological order. To go from chronological order to reverse chronological order and vice versa, simply click on YEAR again.
    </p>
    <p>
        By clicking on HITS, the documents are ordered by frequency. To go from low to high frequency or vice versa, simply click on HITS again.
    </p>
    <h4>Hits Grouped</h4>
    <p>
        In this view the search result can be grouped in different ways, all related to the hit text, which makes a first analysis of the search results easier. To use this view, click on HITS GROUPED. Then select in the drop down list the feature by which you want to group your search results. This can be <i>document title, hit text, lemma, hit PoS, lemma and PoS, word left, word right</i> or <i>year</i>. For instance, grouping the results of the lemma query <em>vrouw</em> ('wife') <em>by hit text</em> will display the frequency of occurrence of each word form in the paradigm of the lemma.
    </p>
    <p>
        It is possible to see concordances of one group in the overview by clicking on the green bar with the frequency number. In the concordance view that appears, you can get more concordances in the same view by clicking on LOAD MORE CONCORDANCES. To restore the original view without concordances, click on the same green bar again. It is possible to get a more detailed view of the concordances in a group, by clicking on VIEW DETAILED CONCORDANCES IN THIS GROUP. However, to change from the detailed concordances view back to the per-hit view, the search has to be repeated.
    </p>
    <h4>Documents Grouped</h4>
    <p>
        This view is similar to "Hits grouped" but now the data is grouped in different ways, all related to information on the document. To use this view, click on DOCUMENTS GROUPED. Then select in the drop-down list the feature by which you want to group your search results. This can be <i>number of hits, by year and by author</i>. <i>Number of hits</i> gives the number of documents per frequency of hits in a document of your search result, <i>by year</i> gives the number of documents per year in your search result, <i>by author</i> gives the number of documents per author in your search result.
    </p>
    <p>
        To see the documents per overview, do the same as described in "Hits grouped", be it that now you see an orange bar. By clicking on the orange bar, you get an overview of the document titles that match.
    </p>
    <h3>CQL query</h3>
    <h4>Corpus Query Language</h4>
    <p>Click on the tab "CQL query"  to use the Corpus Query Language. This is an advanced query language developed at IMS, University of Stuttgart in the early 1990s, designed to support very specific retrieval of phrase types in the corpus. It expresses phrase queries as sequences of token queries. It is therefore mainly useful if you want to find specific types of phrases in a larger text. An example of a simple query (note that the quotes are required): <code>"grote" ".*heid"</code>.</p>
    <p>This is how you search for the word "grote" followed by a word ending with "heid", using regular expressions to specify the pattern for the second word. Equivalent to the above query is: <code>[word="grote"] [word=".*heid"]</code> which has the typical form of a CQL query: a phrase query built up from token queries surrounded by square brackets.</p>
    <h4>Single token queries</h4>
    <p>These typically consist of a combination of simple attribute value queries in the form of either:
    <ul>
        <li>token attribute=single token regular expression <code>[word=".*heid"]</code> surrounded by square brackets</li>
        <li>default token attribute regular expression <code>".*heid"</code></li>
    </ul>
    </p>
    <p>In this corpus, the following token attributes are available for querying:
    <ul>
        <li>word - The word as it was written. This is the default attribute in this corpus, so querying by only giving a word between brackets, eg. "man" means asking for [word="man].</li>
        <li>lemma - Dictionary headword form of words</li>
        <li>pos - Part of speech</li>
    </ul>
    </p>
    <p>
    A typical example using all three token attributes: <code>[pos="AA.*"] [lemma="man" & word != "man"]</code>. This is how you search for adjectives followed by an occurrence of the lemma "man", which may or may not be the form 'man' itself.
    </p>
    <h4>Phrase queries</h4>
    <p>
    As you have seen, phrase queries can simply consist of a sequence of single token queries. Apart from this, regular expression  notations are available to express sequences of tokens. For example: <code>"der.*"{2,}</code>. This query finds two or more successive words starting with "der". At the token level, regular expression operators such as *, + and ? are available. Another example: <code>[pos="AA.*"]+ "man"</code>. This will find the word "man" with one or more adjectives applied to it. 
    </p>
    <h4>Summary of Corpus Query Language support</h4>
    <p>
        The following CQL constructs are supported:
        <ul>
            <li>
            Token constraints of the form [word="koe"] or "koe" (default property). Constraint values may be regular expressions, e.g. [word="str.+"] . The regular expression operators are:
            <ul>
                <li><code>.</code> (full stop) matches arbitrary character: b.k finds bok, bak, bek, bik, etc.. </li>
                <li><code>*</code> matches zero or more occurrences of the preceding letter or bracketed group: .*schip finds words ending with schip (also matching "schip"), dia.* finds words beginning with dia, .*deel.* finds words with deel in the middle.</li>
                <li><code>+</code> matches 1 or more occurrences of the preceding letter or bracketed group: .+schip finds words ending with schip (not matching "schip")</li>
                <li><code>{n,m}</code> matches a sequence of n to m occurrences of preceding letter or group. Use {n} to find a sequence of length n, {n,}  to find at least n, {0,n} to find at most n: <code>[word=".*[aeiou]{5,6}.*"]</code> finds words containing a group of 5 or 6 vowels</li>
                <li><code>?</code> The bracketed items are optional characters: blond(e)? finds blond and blonde </li>
                <li><code>|</code> Vertical bar (disjunction): paard|koe|schaap  searches for all of these items</li>
                <li><code>[]</code> Square brackets (character groups): b[ae]k finds bak, bek</li>
                <li><code>\</code> To search for a full stop, use the backslash and the full stop: Dr\. finds Dr.</li>
            </ul>
            </li>
            <li>
                Constraints may be combined by using boolean operators, both between token specifications (e.g. "stad" | "dorp" ) and within token specifications (e.g. [lemma="zijn" & pos="VRB.*"] ). Supported boolean operators are ! (not), & (and) and | (or). Implication (->) is not supported yet. Parentheses may be used to group expressions. 
            </li>
            <li>Phrase searches, by putting several token specifications in sequence, e.g.: "de" [lemma="koe"] </li>
            <li>You can apply regular expression operators (* + ? {a,b}) to token specifications, e.g.: [type="VRB.*"]+ (one or more verbs) or "k.*"{3,} (three or more words starting with k) </li>
            <li>You can use match all tokens ([]) to match any word, e.g. "koe" []{1,2} "schaap" to find "koe" and "schaap" in that order with 1-2 words between them. </li>
            <li>You can search for XML tags (in the current version the only indexed tag is  &lt;s/&gt;, sentence) in the following ways: &lt;s&gt; "Gelukkig" (word at start of sentence), "gelukkig" &lt;/s&gt; (word at end of sentence). </li>
        </ul>
    </p>
    
<p class='spacer'><a name='demo'></a>&nbsp;</p>
    <h2>DEMO</h2>
<p>This is a DEMO release of <i>AutoSearch</i>. It may contain bugs and is not 
representative of the final product.</p>
<p class='endspacer'><a name='end'></a>&nbsp;</p>

