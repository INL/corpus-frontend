# BlackLab AutoSearch

This is a corpus search application that works with BlackLab Server. At the Dutch Language Institute, we use it to publish our corpora such as [CHN](http://chn.inl.nl/) (CLARIN login required), [Letters as Loot](http://brievenalsbuit.inl.nl/) and [AutoSearch](http://portal.clarin.inl.nl/autocorp/) (CLARIN login required).

Requirements: 
----
- Java 1.8 
- A java servlet container such as [Apache Tomcat](http://tomcat.apache.org/)
- An instance of [BlackLab-Server](https://github.com/INL/BlackLab/).  
**Currently requires [prerelease 1.7.0-ALPHA](releases/tag/v1.7.0-ALPHA)) or newer, CSV export requires the dev branch of blacklab.**

Getting started
----
- Clone this repository, use `mvn package` to build the WAR file (or download the .war from the latest release) and add corpus-frontend.war to Tomcat's webapps directory.
- Optionally, create a file `corpus-frontend.properties` (name must be the same as the .war file) in the same directory as the BlackLab Server config file (e.g. `/etc/blacklab/`).
- Navigate to `http://localhost:8080/corpus-frontend/` and you will see a list of the available you can search.

# Options 

## Application options  

```
blsUrl=http://localhost:8080/blacklab-server/
blsUrlExternal=/blacklab-server/
corporaInterfaceDataDir=/etc/blacklab/projectconfigs/
corporaInterfaceDefault=default
listvalues= (empty)
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
- `listvalues`  
A comma-separated list of word properties (such as lemma and pos) that should have be autocompletion enabled in the interface. A select or combo box is shown depending on the amount of possible values. This setting will be moved to BlackLab iteself in the near future. 
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

-----------

We will expand on this documentation soon, and also cover how to set up the application so users can log in upload their own corpora (disabled by default).

For now, if you have any questions or experience any issues, please contact [Jan Niestadt](mailto:jan.niestadt@ivdnt.org) and/or [Koen Mertens](mailto:koen.mertens@ivdnt.org).

Like BlackLab, this corpus frontend is licensed under the [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0).
