# BlackLab AutoSearch

This is a corpus search application that works with BlackLab Server. At the Dutch Language Institute, we use it to publish our corpora such as [CHN](http://chn.inl.nl/) (CLARIN login required), [Letters as Loot](http://brievenalsbuit.inl.nl/) and [AutoSearch](http://portal.clarin.inl.nl/autocorp/) (CLARIN login required).

Requirements: 
----
- Java 1.8 
- A java servlet container such as [Apache Tomcat](http://tomcat.apache.org/).  
Use Tomcat 7 version `7.0.76` or newer or Tomcat 8 version `8.0.42` or newer. Using older versions will cause some [warnings from dependencies](https://bz.apache.org/bugzilla/show_bug.cgi?id=60688).
- An instance of [BlackLab-Server](https://github.com/INL/BlackLab/) `1.7` or newer.

Getting started
----
- Clone this repository, use `mvn package` to build the WAR file (or download the .war from the latest release) and add corpus-frontend.war to Tomcat's webapps directory.
- Optionally, create a file `corpus-frontend.properties` (name must be the same as the .war file) in the same directory as the BlackLab Server config file (e.g. `/etc/blacklab/`).
- Navigate to `http://localhost:8080/corpus-frontend/` and you will see a list of the available corpora you can search.

# Options 

## Application options  

```
blsUrl=http://localhost:8080/blacklab-server/
blsUrlExternal=/blacklab-server/
corporaInterfaceDataDir=/etc/blacklab/projectconfigs/
corporaInterfaceDefault=default
wordend=5000
```

- `blsUrl`  
Address where the Corpus-Frontend server can reach BlackLab-Server.
- `blsUrlExternal`  
Address where the browser javascript can reach BlackLab-Server.
- `corporaInterfaceDataDir`  
Optional directory where you can place files to further configure and customize the interface on a per-corpus basis.  
Files should be placed in a directory with the name of your corpus, e.g. files for a corpus `MyCorpus` should be placed under `corporaInterfaceDataDir/MyCorpus/...`
- `corporaInterfaceDefault`  
Optional default directory that's used as a fallback if a file cannot be found in the `corporaInterfaceDataDir/MyCorpus/...` directory.
- `wordend`  
The (maximum) amount of words displayed when viewing documents within a corpus.  

## Per corpus options

**Per corpus configuration is not supported for user corpora created through the Corpus-Frontend.**  

By placing certain files in the `corporaInterfaceDataDir` it's possible to customize several aspects of a corpus.  
Files must be placed in a subdirectory with the same name as the corpus; files for `MyCorpus` should be placed in `corporaInterfaceDataDir/MyCorpus/...`  
May contain the following files and directories:

- `Search.xml`  
Allows you to (among other things) set the navbar links and inject custom css/js.
See [the default configuration](https://github.com/INL/corpus-frontend/blob/dev/src/main/webapp/WEB-INF/interface-default/search.xml).
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

## Other options
There are some other small ways the interface can be configured.
- `uiType`  
When defining your own corpus format, you can optionally attach a `uiType` to complexField properties and metadata fields.  
It should roughly look like this in your config file:
    ```yaml
    # For a normal word property, the uiType should be defined at the annotation level
    annotatedFields:
        contents:
            ...

            annotations:
            - name: ...
              valuePath: ...
              uiType: 

    # For a metadata field, the uiType should be defined at the field level
    metadata:
        ...

        fields:
        - name: ...
          valuePath: ...
          uiType: 
    ```
The uiType determines how input fields are shown in the search form.

### For word properties
- `text` _(default)_  
Shows the field as a regular text box.  
- `select`  
Will force the field to show as a dropdown menu showing all values for the property. 
Note that this will remove the option to enter wildcards or multiple words, and will disable the wordlist upload for that field.  
**Warning: select is limited to 500 values!**  
- `combobox`  
Will enable autocompletion on the field, but still allow you to enter any value.  

### For metadata properties
The same options apply, but unlike normal property fields, we will autodetect the best setting when no uiType has been set for the field.
Fields with only a couple of values will be set to `select`, other fields will typically be set to `combobox`.  

- `text/select/combobox`  
**Warning: select is limited to 50 (not 500) values!**
- `range`  
This will split the field into two inputs, this can be useful for things like dates and ages.

-----------

We will expand on this documentation soon, and also cover how to set up the application so users can log in upload their own corpora (disabled by default).

For now, if you have any questions or experience any issues, please contact [Jan Niestadt](mailto:jan.niestadt@ivdnt.org) and/or [Koen Mertens](mailto:koen.mertens@ivdnt.org).

Like BlackLab, this corpus frontend is licensed under the [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0).
