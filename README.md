# BlackLab AutoSearch

This is a corpus search application that works with BlackLab Server (NOTE: right now, it only works with the version on the dev branch, or [prerelease 1.7.0-ALPHA](https://github.com/INL/BlackLab/releases/tag/v1.7.0-ALPHA)). At the Dutch Language Institute, we use it to publish our corpora such as [CHN](http://chn.inl.nl/) (CLARIN login required), [Letters as Loot](http://brievenalsbuit.inl.nl/) and [AutoSearch](http://portal.clarin.inl.nl/autocorp/) (CLARIN login required).

To use it, index a corpus using BlackLab and install BlackLab Server (see the [BlackLab project page](http://inl.github.io/Blacklab/)). Again, you need either 1.7.0-ALPHA or the dev version at this time.

Clone this repository, use `mvn package` to build the WAR file (or download the .war from the latest release) and add corpus-frontend.war to Tomcat's webapps directory.

Also create a file `corpus-frontend.properties` (name must be the same as the .war file) in the same directory as the BlackLab Server config file (e.g. `/etc/blacklab/`), containing the following:

```
blsUrl=http://localhost:8080/blacklab-server/
blsUrlExternal=/blacklab-server/
```

Navigate to http://SERVERNAME:8080/corpus-frontend/ and you will see a list of available corpora you can search.

We will expand on this documentation soon, and also cover how to set up the application so users can log in upload their own corpora (disabled by default).

For now, if you have any questions or experience any issues, please contact [Jan Niestadt](mailto:jan.niestadt@ivdnt.org) and/or [Koen Mertens](mailto:koen.mertens@ivdnt.org).

Like BlackLab, this corpus frontend is licensed under the [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0).
