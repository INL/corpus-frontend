# BlackLab AutoSearch

This is a corpus search application that works with BlackLab Server (NOTE: right now, it only works with the version on the dev branch, or [prerelease 1.7.0-ALPHA](https://github.com/INL/BlackLab/releases/tag/v1.7.0-ALPHA)). At the Dutch Language Institute, we use it to publish our corpora such as [CHN](http://chn.inl.nl/) (CLARIN login required), [Letters as Loot](http://brievenalsbuit.inl.nl/) and [AutoSearch](http://portal.clarin.inl.nl/autocorp/) (CLARIN login required).

To use it, index a corpus using BlackLab and install BlackLab Server (see the [BlackLab project page](http://inl.github.io/Blacklab/)). Again, you need either 1.7.0-ALPHA or the dev version at this time.

Clone this repository, use `mvn package` to build the WAR file (or download the .war from the latest release) and add corpus-frontend.war to Tomcat's webapps directory.

Optionally, also create a file `corpus-frontend.properties` (name must be the same as the .war file) in the same directory as the BlackLab Server config file (e.g. `/etc/blacklab/`), containing the following (these are the default values, automatically used if the file is missing):

```
blsUrl=http://localhost:8080/blacklab-server/
blsUrlExternal=/blacklab-server/
corporaInterfaceDataDir=/etc/blacklab/projectconfigs/
listvalues=
```

NOTE: the corporaInterfaceDataDir is an optional directory in which you can place a subdirectory for each corpus with files search.xml, about.inc and help.inc, and XSLT files, to customize the look of the application for that corpus. Have a look at src/main/webapp/WEB-INF/interface-default for examples of these files. The files in that directory is are used if no corpus-specific ones are found.

NOTE: listvalues can contain a comma separated list of properties (such as pos) for which the values will be retrieved. Values will be shown as a select or combo box depending on the completeness of the list.

Navigate to http://SERVERNAME:8080/corpus-frontend/ and you will see a list of available corpora you can search.

We will expand on this documentation soon, and also cover how to set up the application so users can log in upload their own corpora (disabled by default).

For now, if you have any questions or experience any issues, please contact [Jan Niestadt](mailto:jan.niestadt@ivdnt.org) and/or [Koen Mertens](mailto:koen.mertens@ivdnt.org).

Like BlackLab, this corpus frontend is licensed under the [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0).
