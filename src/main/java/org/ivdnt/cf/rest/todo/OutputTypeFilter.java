package org.ivdnt.cf.rest.todo;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.PreMatching;

import java.io.IOException;
import java.util.List;

import org.apache.commons.lang3.StringUtils;

/**
 * check to see if there is an outputType= parameter in the query string
 * if so, set the Accept header to prefer that type
 */
@PreMatching // required to modify accept header, otherwise it's already been parsed/committed.
public class OutputTypeFilter implements ContainerRequestFilter {
    @Override
    public void filter(ContainerRequestContext request) throws IOException {
        String outputType = request.getUriInfo().getQueryParameters().getFirst("outputType");
        if (outputType == null) outputType = request.getUriInfo().getQueryParameters().getFirst("outputtype");
        if (outputType == null) outputType = request.getUriInfo().getQueryParameters().getFirst("outputFormat");
        if (outputType == null) outputType = request.getUriInfo().getQueryParameters().getFirst("outputformat");

        if (outputType != null) {
            switch(outputType.toLowerCase()) {
            case "json": {
                outputType = "application/json";
                break;
            }
            case "html": {
                outputType = "text/html";
                break;
            }
            case "text": {
                outputType = "text/plain";
                break;
            }
            case "xml": {
                outputType = "application/xml";
                break;
            }
            default: {
                return;
            }
            }
            outputType += ";q=1.0";


            final String existing = request.getHeaders().getFirst("Accept");
//            final String newAccept = existing == null ? outputType : outputType + "," + existing;
            final String newAccept = outputType;

            request.getHeaders().replace("Accept", List.of(newAccept));
        }
    }
}