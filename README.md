# BlackLab AutoSearch

- **[About](#About)**
    - [Intro](#Intro)
    - [Basic usage](#How-to-use)
- **[Installation](#Installation)**
    - [Requirements](#Requirements)
    - [Releases](#Download-a-release)
    - [Building from source](#Building-from-source)
- **[Configuration](#Configuration)**
    - [Backend configuration](#Backend-configuration)
    - [Adding corpora](#Adding-corpora)
    - [User corpora](#Allowing-users-to-add-corpora)
    - [Frontend configuration](#Frontend-configuration)
        - [Search.xml](#Search.xml)
        - [Index formats](#Index-config)
        - [Custom JS](#Custom-JS)
        - [Custom CSS](#Custom-CSS)
- **[Development](#Development)**
    - [Frontend Javascript](#Frontend-Javascript)
      - [Application structure](#Application-structure)
      - [The Vuex store](#The-Vuex-store)
      - [URL generation and parsing](#URL-generation-and-parsing)
      - [Development tips](#Development-tips)
    - [Backend development](#Backend-development)



About
===================


## Intro

This is a corpus search application that works with [BlackLab Server](https://github.com/INL/BlackLab/).  
At the Dutch Language Institute, we use it to publish our corpora such as [CHN](http://chn.inl.nl/) (CLARIN login required), [Letters as Loot](http://brievenalsbuit.inl.nl/) and [AutoSearch](http://portal.clarin.inl.nl/autocorp/) (CLARIN login required).


## How to use

Help is contained in the application in the form of a _page guide_ that can be opened by clicking the button on the right of the page.

![](docs/img/page_guide.png)



Installation
===================

## Requirements:

- Java 1.8
- A java servlet container such as [Apache Tomcat](http://tomcat.apache.org/).
Use Tomcat 7 version `7.0.76` or newer or Tomcat 8 version `8.0.42` or newer. Using older versions will cause some [warnings from dependencies](https://bz.apache.org/bugzilla/show_bug.cgi?id=60688).
- An instance of [BlackLab-Server](https://github.com/INL/BlackLab/).
While we do our best to make the frontend work with older versions of BlackLab, use a matching version of BlackLab (so `corpus-frontend v2.0` with `blacklab-server v2.0`).

## Download a release

Releases can be downloaded [here](https://github.com/INL/corpus-frontend/releases).

## Building from source

- Clone this repository, use `mvn package` to build the WAR file (or download the .war from the latest release) and add corpus-frontend.war to Tomcat's webapps directory.
- Optionally, create a file `corpus-frontend.properties` (name must be the same as the .war file) in the same directory as the BlackLab Server config file (e.g. `/etc/blacklab/`).  
See the [Configuration section](#Backend-configuration) for more information.
- Navigate to `http://localhost:8080/corpus-frontend/` and you will see a list of available corpora you can search.

For further development and debugging help, see the [Development section](#Development).



Configuration
====================


## Backend configuration

The backend is configured through a config file `corpus-frontend.properties`.
This file must be located in one of the following locations (in order of priority):
- `%AUTOSEARCH_CONFIG_DIR%`
- `/etc/blacklab/`
- `/vol1/etc/blacklab/` (linux only)
- `%tmp%`

Example file and defaults:

```properties

# The url under which the back-end can reach blacklab-server.
# Separate from the front-end to allow connections for proxy situations 
#  where the paths or ports may differ internally and externally.
blsUrl=http://localhost:8080/blacklab-server/

# The url under which the front-end can reach blacklab-server.
blsUrlExternal=/blacklab-server/

# Optional directory where you can place files to further configure and customize 
#  the interface on a per-corpus basis.
# Files should be placed in a directory with the name of your corpus, e.g. files
#  for a corpus 'MyCorpus' should be placed under 'corporaInterfaceDataDir/MyCorpus/'.
corporaInterfaceDataDir=/etc/blacklab/projectconfigs/

# For unconfigured corpora, the directory where defaults may be found (optional).
# The name of a directory directly under the corpusInterfaceDataDir.
# Files such as the help and about page will be loaded from here 
#  if they are not configured/available for a corpus.
# If this directory does not exist or is not configured, 
#  we'll use internal fallback files for all essential data.
corporaInterfaceDefault=default

# Default (and maximum) number of words to show per page 
#  in opened documents (/article page)
wordend=5000

# Path to frontend javascript files (can be configured to aid development, e.g. 
#  loading from an external server so the java web server does not need 
#  to constantly reload, and hot-reloading/refreshing of javascript can be used).
jspath=/corpus-frontend/js

# The following properties do not have a default value
# googleAnalyticsKey=
```


## Adding corpora

Corpora may be [added manually](http://inl.github.io/BlackLab/indexing-with-blacklab.html) or [uploaded by users](#Allowing-users-to-add-corpora) (if configured).

After a corpus has been added, the corpus-frontend will automatically detect it, a restart should not be required.


## Allowing users to add corpora

### Configuring BlackLab

To allow this, BlackLab needs to be configured properly (user support needs to be enabled and user directories need to be configured).  
See [here](http://inl.github.io/BlackLab/blacklab-server-overview.html#examples) for the BlackLab documentation on this (scroll down a little).

When this is done, two new sections will appear on the main corpus overview page.  
They allow you to define your own configurations to customize how blacklab will index your data, create private corpora (up to 10), and add data to them.

**Per corpus configuration is not supported for user corpora created through the Corpus-Frontend.**

### Formats

Out of the box, users can create corpora and upload data in any of the formats supported by BlackLab (`tei`, `folia`, `chat`, `tsv`, `plaintext` and more).  
In addition, users can also define their own formats or extend the builtin formats.

### Index url

There is also a hidden/experimental page (`/corpus-frontend/upload/`) for externally linking to the corpus-frontend to automatically index a file from the web.  
It can be used it to link to the frontend from external web services that output indexable files.  
It requires user uploading to be enabled, and there should be a cookie/query parameter present to configure the user name.  
Parameters are passed as query parameters:
```properties
file=http://my-service.tld/my-file.zip
# optional
format=folia
# optional
corpus=my-corpus-name
```

If the user does not own a corpus with this name yet, it's automatically created.  
After indexing is complete, the user is redirected to the search page.


## Frontend configuration

**Per corpus configuration is not supported for user corpora.**  
Though you can still configure them by overriding the defaults.

By placing certain files in the `corporaInterfaceDataDir` it's possible to customize several aspects of a corpus.
Files must be placed in a subdirectory with the same name as the corpus; files for `MyCorpus` should be placed in `corporaInterfaceDataDir/MyCorpus/...`

When a file is not found for a corpus, the frontend will then check the following locations
- The directory specified in `corporaInterfaceDefault`
- [Inside the WAR](src/main/resources/interface-default/)

------------

The data directory may contain the following files and subdirectories:

- `Search.xml`  
Allows you to (among other things) set the navbar links and inject custom css/js.  
See [the default configuration](src/main/resources/interface-default/search.xml).
- `help.inc`  
Html content placed in the body of the `MyCorpus/help/` page.
- `about.inc`  
Html content placed in the body of the `MyCorpus/about/` page.
- `.xsl` files  
These are used to transform documents in your corpus into something that can be displayed on the `article/` page.  
The name of the xsl file that is used to do this is based on the format of files in your corpus (`tei`, `folia`, etc).  
The xslt file that is used has the name `article_<formatName>.xsl`, so `article_tei.xsl` for tei files.  
- `static/`  
A sandbox where you can place whatever other files you may need, such as custom js, css, fonts, logo's etc.  
These files are public, and can be accessed through `MyCorpus/static/path/to/my.file`  

---

The interface may be customized in three different ways:
- [search.xml](#search.xml)
- The config (`.blf.yaml` / `.blf.json`) used to create the corpus
- Javascript & CSS

### **Search.xml**

Allows you to set a custom display name, load custom JS/CSS, edit the shown columns for results.
See [the default configuration](src/main/resources/interface-default/search.xml) for more information.

### **Index config**

> The term format config refers to the `*.blf.yaml` or `*.blf.json` file used to index data into the corpus.

Because the format config specifies the shape of a corpus (which metadata and annotations a corpus contains, what type of data they hold, and how they are related), it made sense to let the format config specify some things about how to display them in the interface.

**NOTE:** These properties need to be set before the first data is added to a corpus, editing the format config file afterwards will not work (though if you know what your are doing, you can edit the `indexmetadata.yaml` or `indexmetadata.json` file by hand and perform the change that way).

### Through the index config you can:

- <details>
    <summary>Change the text direction of your corpus</summary>

    ```yaml
    corpusConfig: 
      textDirection: "rtl"
    ```

    This will change many minor aspects of the interface, such as the order of columns in the result tables, the ordering of sentences in concordances, the text direction of dropdowns, etc.  
    **NOTE:** This is a somewhat experimental feature. If you experience issues or want to see improvements, please [create an issue](https://github.com/INL/corpus-frontend/issues/new)!

    > Special thanks to [Janneke van der Zwaan](https://github.com/jvdzwaan)!

  </details>

- <details>
    <summary>Group annotations into sub sections</summary>

    ```yaml
    corpusConfig:
      annotationGroups:
        contents:
        - name: Basics
          annotations:
          - word
          - lemma
          - pos_head
        - name: More annotations
          addRemainingAnnotations: true
    ```

    The order of the annotations will be reflected in the interface.

    ![](docs/img/annotation_groups.png)

  </details>

- <details>
    <summary>Group metadata into sub sections</summary>

    ```yaml
    corpusConfig:
      metadataFieldGroups:
      - name: Corpus/collection
        fields:
        - Corpus_title
        - Collection
        - Country
    ```

    The order of the fields will be reflected in the interface.

    ![](docs/img/metadata_groups.png)

  </details>

- <details>
    <summary>Change the display strings of values for metadata</summary>

    ```yaml
    metadata:
      fields:
      - name: year
        displayValues: 
          someOtherValue: someOtherDisplayValue
          someValue: someDisplayValue
    ```

    ![](docs/img/value_display_order.png)

    Currently not supported for annotations. 

  </details>

- <details>
    <summary>Designate special metadata fields</summary>

    ```yaml
    corpusConfig:
      specialFields:
        pidField: id
        titleField: Title
        authorField: AuthorNameOrPseudonym
        dateField: PublicationYear
    ```

    These fields will be used to format document title rows in the results table.

    ![](docs/img/metadata_special_fields.png)

  </details>

- <details>
    <summary>Change the type of an annotation</summary>

    ```yaml
    annotatedFields:
      contents:
        annotations:
        - name: "word"
          valuePath: "folia:t"
          uiType: "text"
    ```

    ---

    ### Multiple types are supported:

    - **Text** _(default)_  
      ![](docs/img/annotation_text.png)

    - **Select**  
      Select is automatically enabled when the field does not have a uiType set, and all values are known.  
      **NOTE:** Limited to `500` values! When you specify `select`, we need to know all values beforehand, BlackLab only stores the first `500` values, and ignores values longer than `256` characters. When this happens, we transform the field into a `combobox` for you, so you don't inadvertently miss any options.  
      ![](docs/img/annotation_select.png)

    - **Combobox**  
      Just like `text`, but add a dropdown that gets autocompleted values from the server.
      ![](docs/img/annotation_combobox.png)

    - **POS** _(Part of speech)_  
        This is an extension we use for corpora with split part of speech tags.
        It's mostly meant for internal use, but with some knowhow it can be configured for any corpus with detailed enough information.
        You will need to write a json file containing a `tagset` definition.
        ```typescript
        type Tagset = {
          /**
           * All known values for this annotation.
          * The raw values can be gathered from blacklab
          * but displaynames, and the valid constraints need to be manually configured.
          */
          values: {
            [key: string]: {
              value: string;
              displayName: string;
              /** All subannotations that can be used on this type of part-of-speech */
              subAnnotationIds: Array<keyof Tagset['subAnnotations']>;
            }
          };
          /**
           * All subannotations of the main annotation
          * Except the displayNames for values, we could just autofill this from blacklab.
          */
          subAnnotations: {
            [key: string]: {
              id: string;
              /** The known values for the subannotation */
              values: Array<{
                value: string;
                displayName: string;
                /** Only allow/show this specific value for the defined main annotation values (referring to Tagset['values'][key]) */
                pos?: string[];
              }>;
            };
          };
        };
        ```
        Then, during page initialization, the tagset will have to be loaded by calling

        `vuexModules.tagset.actions.load('http://localhost:8080/corpus-frontend/my-corpus/static/path/to/my/tagset.json');`  
        This has to happen before $(document).ready fires! The reason for this is that the tagset you load determines how the page url is decoded, which is done when on first render.

        ![](docs/img/annotation_pos.png)
        ![](docs/img/annotation_pos_editor.png)
  </details>

- <details>
    <summary>Change the type of a metadata field</summary>

    ```yaml
    metadata:
      fields:
      - name: year
        uiType: range
    ```

    The `text`, `select`, and `combobox` types function identical to the annotations uiTypes.  
    **NOTE:** The `select` type is limited to `50` values (instead of `500` - though unlike with annotations, this can be configured, see [here](https://github.com/INL/BlackLab/issues/85) for more information)!  
    Also, values longer than 256 characters are ignored and will prevent the select from showing (though BlackLab still indexes them, and you can search on them).

    The `pos` type is not supported for metadata.  
    In addition, several new types are available:

    - **Checkbox**  
      Predictably, transforms the dropdown into a checkbox selection.  
      **NOTE:** The same limitations apply as with `select`.
    
      ![](docs/img/metadata_checkbox.png)

    - **Radio**  
      Like checkbox, but allow only one value.  
      **NOTE:** The same limitations apply as with `select`.

      ![](docs/img/metadata_radio.png)

    - **Range**  
      Use two inputs to specify a range of values (usually for numeric fields, but works for text too).

      ![](docs/img/metadata_range.png)
  </details>

### **Custom JS**

These can be enabled on pages by defining them in [search.xml](#Search.xml)  
All javascript should run _before_ `$(document).ready` unless otherwise stated.

> **NOTE:** your javascript file is shared between all pages!  
This means the vuex store might not be available! Check which page you're on beforehand by using the url or detecting whether the store exists and what exists inside it.

Through javascript you can do the following things on the `/search/` page: 

- <details>
    <summary>Show/hide annotations in the explore view</summary>

    In the explore tab, the `n-gram` and `statistics` annotation dropdowns can be filtered to hide certain annotations that aren't useful to show statistics about, but that you may have indexed for other purposes (such as `xmlid`).

    Invalid annotations will be ignored.

    `vuexModules.ui.actions.explore.shownAnnotationIds(['lemma', 'pos', 'word', ...])`
    `vuexModules.ui.actions.explore.defaultAnnotationId('lemma')`

  </details>

- <details>
    <summary>Show hide metadata (grouping options) in the explore view</summary>

    Invalid metadata fields will be ignored.

    `vuexModules.ui.actions.explore.shownMetadataFieldIds(['title', 'year', 'location', ...])`
    `vuexModules.ui.actions.explore.defaultMetadataFieldId('title')`
  </details>

- <details>
    <summary>Change the columns in the hits table</summary>

    Initially these columns are based on `propColumns` from `search.xml`, but this is the newer way of defining these.  
    Invalid annotations will be ignored.

    `vuexModules.ui.actions.results.hits.shownAnnotationIds(['lemma', 'pos', 'word', ...])`
  </details>

- <details>
    <summary>Enable an audio player for spoken corpora</summary>

    This will create small play buttons in concordances, allowing the user to listen to the fragment. We use this feature in the `CGN (Corpus Gesproken Nederlands)` corpus. 

    ![](docs/img/concordance_audio_player.png)

    To enable this, three things are needed: 
    - The corpus needs to be annotated with some form of link to an audio file in the document metadata (or token annotations).
    - You need to have hosted the audio files somewhere. 
      **NOTE:** The `/static/` directory will not work, as the server needs to support the http `range` headers, which that implementation does not. (PR would be most welcome!)
    - A function that transforms a result into a start- and endtime inside the audio file. 

    Shown here is (an edited version of) the function we use in the `CGN`, but specific implementation will of course be unique to your situation. 
    ```javascript
    /**
     * @param {string} corpus - name of the corpus 
     * @param {string} docId - id of the document from which this hit originated
     * @param {BLHitSnippet} snippet - the hit, looks like the following: 
     * {
     *   left: {
     *     lemma: ["this", "is", "an", "example"]
     *     begintime: [1,3,5,7]
     *     endtime: [2,4,6,8]
     *   },
     *   match: {
     *     begintime: [9]
     *     endtime: [10]
     *     // ... etc
     *   },
     *   right: {
     *     // ... 
     *   }
     * }
     */
    vuexModules.ui.getState().results.hits.getAudioPlayerData = function(corpus, docId, snippet) {
      var s = 'begintime';
      var e = 'endtime';

      // Find the first entry of 'begintime' in [left, match, right]
      const startString = snippet.left[s].concat(snippet.match[s]).concat(snippet.right[s]).find(function(v) { return !!v; });
      // Last entry of 'endtime' in [left, match, right]
      const endString = snippet.left[e].concat(snippet.match[e]).concat(snippet.right[e]).reverse().find(function(v) { return !!v; });

      // Returning undefined will disable the player for this hit
      if (!startString && !endString) {
        return undefined;
      }

      // Transform format of HH:MM:SS.mm to a float
      var start = startString ? startString.split(':') : undefined;
      start = start ? Number.parseInt(start[0], 10) * 3600 + Number.parseInt(start[1], 10) * 60 + Number.parseFloat(start[2]) : 0;

      // Transform format of HH:MM:SS:mm to a float
      var end = endString ? endString.split(':') : undefined;
      end = end ? Number.parseInt(end[0], 10) * 3600 + Number.parseInt(end[1], 10) * 60 + Number.parseFloat(end[2]) : Number.MAX_VALUE;

      // Returns should have this format
      // docId is echoed to allow caching of the audio player data between hits in the same document.
      return {
        docId: docId,
        startTime: start,
        endTime: end,
        url: config.audioUrlBase + docId + '.mp3'
      }
    }
    ```
  </details>

- <details>
    <summary>Override any other data you want</summary>

    If you know what you're doing, it's possible to override any value in the store.  
    The `corpus` module (`vuexModules.corpus`) contains all data used to render the page, including the annotations, metadata fields, display names, descriptions, uiTypes, etc.  
    This object is writable and can be interacted with from the console or javascript, so tinker away.  

    Changing the ids of annotations/metadata will result in broken queries though! :)

  </details>

----

The `/article/` page has other features that can be enabled.  
Enabling any of these will show a new tab `Statistics` next to the default `Content` and `Metadata` tabs.

- <details>
    <summary>A table with whatever data you wish to show.</summary>

    You may provide a function with the signature `(BLDocument, BLHitSnippet) => { [key: string]: string; }` (see [blacklabTypes](../src/types/blacklabtypes.ts) for type definitions)
    ```javascript
    vuexModules.root.actions.statisticsTableFn(function(document, snippet) {
        var ret = {};
        ret['Tokens'] = document.docInfo.lengthInTokens;
        ret['Types'] = Object.keys(snippet.match['pos'].reduce(function(acc, v) {
            acc[v] = true;
            return acc;
        }, {})).length;
        ret['Lemmas'] = Object.keys(snippet.match['lemma'].reduce(function(acc, v) {
            acc[v] = true;
            return acc;
        }, {})).length

        var ratio = ret['Tokens'] / ret['Types'];
        var invRatio = 1/ratio;
        ret['Type/token ratio'] = '1/'+ratio.toFixed(1)+' ('+invRatio.toFixed(2)+')';

        return ret;
    });
    ```
    ![](docs/img/article_table.png)
    
  </details>
 
- <details>
    <summary>A pie chart displaying the frequency of an annotation's values</summary>

    ```javascript
    vuexModules.root.actions.distributionAnnotation({
        displayName: 'Token/Part of Speech Distribution',
        id: 'pos_head'
    });
    ```
    ![](docs/img/article_pie.png)

  </details>

- <details>
    <summary>A graph showing growth of annotations in the document</summary>

    ```javascript
    vuexModules.root.actions.growthAnnotations({
        displayName: 'Vocabulary Growth',
        annotations: [{
            displayName: 'Word types',
            id: 'word'
        }, {
            displayName: 'Lemmas',
            id: 'lemma'
        }],
    });
    ```
    ![](docs/img/article_chart.png)

  </details>

- <details>
    <summary>The color palette for the charts</summary>
    
    If you're using custom css, this can help them blend in with your own style.  
    <span style="color: white; background: #337ab7; display: inline-block; border-radius: 3px; padding: 0 0.5em;">Defaults to bootstrap 3 primary blue (`#337ab7`).</span>

    ```javascript
    vuexModules.root.actions.baseColor('#9c1b2e');
    ```

  </details>

### **Custom CSS**

We have included a template [SASS](https://sass-lang.com/) file [here](src/frontend/src/style-template.scss) to allow you to customize your page's color theme easily.  
From there you can then add your own customizations on top.

Create a file with the following contents  

```scss
// custom.scss

$base: hsl(351, 70%, 36%); // Defines the base color of the theme, this can be any css color
@import 'style-template.scss'; // the absolute or relative path to our template file

// Your own styles & overrides here ...

```
You now need to compile this file by following the following steps:
- Install [Node.js](https://nodejs.org/en/)
- Install the `node-sass` package by running `npm install -g node-sass`
- Compile the file by running `node-sass -o . custom.scss`

You will now have a `custom.css` file you can include in your install through `search.xml`.

Development
===================

## Frontend Javascript

The app is primarly written in [Vue.js](https://vuejs.org/).  
Outlined here is the `/search/` page, as it contains the majority of the code.  

### **Application structure**

Entry points are the following files
- [article.ts](src/frontend/src/article.ts)  
  Handles the hit navigation, graphs and charts on the document page `/corpus-frontend/docs/...`
- [corpora.ts](src/frontend/src/corpora.ts)  
  The main index page (or `/corpus-frontend/corpora/`)  
- [remote-index.ts](src/frontend/src/remote-index.ts)  
  The `/upload/` page.
- [search.ts](src/frontend/src/search.ts)  
  The search form

Individual components are contained in the [pages](src/frontend/src/pages) directory. These components are single-use and/or connected to the store in some way.  
The [components](src/frontend/src/components) directory contains a few "dumb" components that can be reused anywhere.

### **The Vuex store**

We use [vuex](https://vuex.vuejs.org/guide/) to store the app state, treat it as a central database (though it's not persisted between sessions).  
The vuex store is made up of many `modules` that all handle a specific part of the state, such as the metadata filters, or the settings menu (page size, random seed).

The [form](src/frontend/src/store/search/form) directory contains most of the state to do with the top of the page, such as filters, query builder, explore view.  
The [results](src/frontend/src/store/search/results) directory handles the settings that directly update the results, such as which page is open, how results are grouped, etc.

A couple of modules have slightly different roles: 
- The [corpus](src/frontend/src/store/search/corpus.ts) module stores the blacklab index config and is used almost everywhere.  
- The [history](src/frontend/src/store/search/history.ts) module stores the query history (_not the browser history_).
- The [query](src/frontend/src/store/search/query.ts) module contains a snapshot of the form (with filters, patterns, etc) as it was when `submit` was pressed.  
  This is what actually determines the results being shown, and is what render the query summary etc.
- The [tagset](src/frontend/src/store/search/tagset.ts) module is mostly inactive, but it stores the info to build the editor for the `pos` uiType. 

### **URL generation and parsing**

The current page url is generated and updated in [streams.ts](src/frontend/src/store/search/streams.ts).  
It contains a few things: a stream that listens to state changes in the `vuex` store, and is responsible for updating the page url, and a couple streams that fetch some metadata about the currently selected/searched corpus (shown below the filters and at the top of the results panel).  
![](docs/img/filter_overview.png)  
![](docs/img/result_totals.png)  

Url parsing happens in the [UrlStateParser](src/frontend/src/store/search/util/url-state-parser.ts).  
The url parsing is a little involved, because depending on whether a `tagset` is provided it can differ (the cql pattern is normally parsed and split up so we know what to place in the `simple` and `extended` views, but this needs to happen differently when a tagset is involved).  
Because of this, the store is first initialized (with empty values everywhere), then the url is parsed, after which the state is updated with the parsed values (see [search.ts](src/frontend/src/search.ts)).  
When navigating back and forth through browser history, the url is not parsed, instead the state is attached to the history entry and read directly.

### **Development tips**

Install the Vue devtools! ([chrome](https://chrome.google.com/webstore/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd), [firefox](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)).

You can compile and watch the javascript files using webpack.  
Execute `npm run start` in the `src/frontend/` directory. This will start `webpack-dev-server` (webpack is a javascript build tool) that will serve the compiled files (the [entry points](#structure)) at `localhost/dist/`.  
It adds a feature where if one of those files is loaded on the page, and the file changes, your page will reload automatically with the new changes.

Combining this with `jspath` in `corpus-frontend.properties` we can start the corpus-frontend as we normally would, but sideload our javascript from `webpack-dev-server` and get realtime compilation :)

```properties
# No trailing slash!
jspath=http://localhost:80/dist
```
```bash
cd corpus-frontend/src/frontend/
npm run start
```

One note is that by default the port is `8080`, but we changed it to `80`, as `tomcat` already binds to `8080`. To change this, edit the `scripts.start` property in [package.json](src/frontend/package.json).


## Backend development

The backend is written in Java, and does comparitively little.  
Its most important tasks are serving the right javascript file and setting up a page skeleton (with [Apache Velocity](http://velocity.apache.org/)).  

When a request comes in, the `MainServlet` fetches the relevant corpus data from BlackLab, reads the matching `search.xml` file, and determines which page to serve (the `*Response` classes). Together this renders the header, footer, defines some client side variables (mainly urls to the corpus frontend server and blacklab servers).  
From there on out the rest happens clientside.  

It also handles most of the `document` page, retrieving the xml and metadata and converting it to html.

<br>
<br>
<br>

-----------

If you have any further questions or experience any issues, please contact [Jan Niestadt](mailto:jan.niestadt@ivdnt.org) and/or [Koen Mertens](mailto:koen.mertens@ivdnt.org).

Like BlackLab, this corpus frontend is licensed under the [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0).
