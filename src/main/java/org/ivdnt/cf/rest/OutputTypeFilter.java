package org.ivdnt.cf.rest;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * check to see if there is an outputType= parameter in the query string
 * if so, set the Accept header to prefer that type
 */
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
            case "xml": {
                outputType = "application/xml";
                break;
            }
            }

            final String existing = request.getHeaders().getFirst("Accept");
            final String newAccept = existing == null ? outputType : outputType + "," + existing;

            System.out.println("Replaced accept header with " + newAccept);

            request.getHeaders().replace("Accept", List.of(newAccept));
        }
    }
}