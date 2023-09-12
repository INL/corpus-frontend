package org.ivdnt.cf.utils2;

import java.io.File;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;

import javax.xml.transform.TransformerException;

public class CorpusFileUtil {

    /**
     * Get a file from the directory belonging to this corpus and return it, attempting to get a default if that fails.
     * User corpora never have their own directory, and so will only use the locations for the defaults.
     *
     * <pre>
     * Tries in several locations:
     * - First try PROP_DATA_PATH/corpus/ directory (if configured, and this is not a user corpus)
     * - Then try PROP_DATA_PATH/PROP_DATA_DEFAULT directory (if configured)
     * - Finally try WEB-INF/interface-default
     * </pre>
     *
     * @param filesDir - the root dir where per-corpus files are stored (so the base dir that contains subdirectories for individual corpora)
     * @param corpus - corpus for which to get the file. If null or a user-defined corpus, only the default locations are checked.
     * @param fallbackCorpus - for when the corpus does not exist, try this one instead (i.e. {@link org.ivdnt.cf.GlobalConfig.Keys#FRONTEND_CONFIG_PATH_DEFAULT}).
     * @param filePath - path to the file relative to the directory for the corpus.
     * @return the file, if found
     */
    public static Optional<File> getProjectFile(String filesDir, Optional<String> corpus, Optional<String> fallbackCorpus, String filePath) {
        Optional<Path> dataDir = getIfValid(filesDir);
        return dataDir
            // try the file in the corpus' own data directory,
            // (only when a valid non-user corpus)
            // (we don't support configuring user corpora)
            // There's no reason that couldn't work, but since users can't upload the files to do so anyway,
            // configure it, it's not worth the effort (and there might be a few gotchas with username to file path mapping).
            .filter(path -> !isUserCorpus(corpus))
            .flatMap(p -> resolveIfValid(p, corpus))
            .flatMap(p -> resolveIfValid(p, filePath))
            // if the lookup above didn't work, try the fallback corpus
            // see https://github.com/INL/corpus-frontend/pull/69
            // In essence, this can be used to supply a default config which also applies to user corpora
            // (albeit as a whole, not individually).
            .or(() -> dataDir
                .flatMap(p -> resolveIfValid(p, fallbackCorpus))
                .flatMap(p -> resolveIfValid(p, filePath))
            )
            .map(Path::toFile)
            .filter(File::canRead)
            // try default file inside .war
            // only available for a couple of standard items (search.xml, some builtin xslt files)
            .or(() -> {
                try {
                    URL url = CorpusFileUtil.class.getResource("/interface-default/" + filePath);
                    if (url == null) return Optional.empty();
                    URI uri = url.toURI();
                    return Optional.of(new File(uri)).filter(File::exists);
                } catch (URISyntaxException e) {
                    return Optional.empty();
                }
            });
    }


    /**
     * Get the stylesheet to convert a document or its metadata from this corpus into
     * an html snippet suitable for inserting in the article.vm page.
     *
     * First attempts to find file "${name}.xsl" in all locations, then,
     * as a fallback, attempts to find "${name}_${corpusDataFormat}.xsl" in all locations.
     * The data format suffix is supported to allow placing xsl files for all corpora in the same fallback directory.
     *
     * "meta.xsl" is used to transform the document's metadata, "article.xsl" for the content.
     *
     * Looks for a file by the name of "article_corpusDataFormat.xsl", so "article_tei" for tei, etc.
     * Separate xslt is used for metadata.
     *
     * @param filesDir - top-level directory where per-corpus files are stored.
     * @param corpus - which corpus to load the file for
     * @param fallbackCorpus - if corpus is not found, try this one instead (for defaults)
     * @param name - the name of the file, excluding extension
     * @param corpusDataFormat - optional name suffix to differentiate files for different formats
     * @return the xsl transformer to use for transformation, note that this is always a new transformer.
     */
    public static Result<XslTransformer, TransformerException> getStylesheet(String filesDir, Optional<String> corpus, Optional<String> fallbackCorpus, String name, Optional<String> corpusDataFormat) {
        String filename = name + ".xsl";
        String fallbackFilename = corpusDataFormat.map(f -> name + "_" + f + ".xsl").orElse(null);

        // resolve file on disk
        Optional<File> file = getProjectFile(filesDir, corpus, fallbackCorpus, filename).or(() -> getProjectFile(filesDir, corpus, fallbackCorpus, fallbackFilename));

        return Result.from(file)
                // Parse xslt if found
                .mapWithErrorHandling(XslTransformer::new)
                // wrap any exception in a TransformerException
                .mapError(e -> new TransformerException(
                        "Error parsing xsl from file " + file.orElseThrow().getName() + ".\n" +
                        (e instanceof TransformerException ? ((TransformerException) e).getMessageAndLocation() : e.getMessage())
                ));
    }

    private static Optional<Path> getIfValid(String path) {
        if (path == null || path.isEmpty())
            return Optional.empty();

        try {
            return Optional.of(Paths.get(path));
        } catch (InvalidPathException e) {
            return Optional.empty();
        }
    }

    /**
     * Resolve the child again the parent and verify that the child is indeed a descendant.
     * Also handle null, illegal paths, empty strings and other such things.
     *
     * @return the new path if everything is alright
     */
    private static Optional<Path> resolveIfValid(Path parent, Optional<String> child) {
        try {
            // prevent upward directory traversal - child must be in parent
            return child.map(parent::resolve).filter(resolved -> resolved.startsWith(parent) && !resolved.equals(parent));
        } catch (Exception e) { // catch anything, a bit lazy but allows passing in null and empty strings etc
            return Optional.empty();
        }
    }

    /** @see #resolveIfValid(Path, Optional<String>) */
    private static Optional<Path> resolveIfValid(Path parent, String child) {
        return resolveIfValid(parent, Optional.ofNullable(child));
    }

    public static boolean isUserCorpus(Optional<String> corpus) {
        return getCorpusOwner(corpus).isPresent();
    }

    /** User corpora are identified by having a colon in their id separating username:corpusname */
    public static Optional<String> getCorpusName(Optional<String> corpus) {
        return corpus.map(id -> id.substring(Math.max(0, id.indexOf(':'))));
    }

    /** User corpora are identified by having a colon in their id separating username:corpusname */
    public static Optional<String> getCorpusOwner(Optional<String> corpus) {
        return corpus.map(id -> { int i = id.indexOf(':'); return i != -1 ? id.substring(0, i) : null; });
    }
}
