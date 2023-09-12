package org.ivdnt.cf.rest.velocity;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.View;

import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.Map;

public class VelocityView implements View {

    @Override
    public String getContentType() {
        return "text/html";
    }

    @Override
    public void render(Map<String, ?> model, HttpServletRequest request, HttpServletResponse response) throws Exception {
        // Set the content headers for the response
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(getContentType());

        // Merge context into the page template and write to output stream
        try (OutputStreamWriter osw = new OutputStreamWriter(response.getOutputStream(), StandardCharsets.UTF_8)) {
            template.merge(context, osw);
            osw.flush();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
