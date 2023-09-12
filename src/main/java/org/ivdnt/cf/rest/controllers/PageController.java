package org.ivdnt.cf.rest.controllers;

import jakarta.servlet.ServletContext;
import org.ivdnt.cf.GlobalConfigProperties;
import org.ivdnt.cf.utils2.BlackLabApi;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller("/")
public class PageController {
    final GlobalConfigProperties config;
    final String contextPath;

    public PageController(GlobalConfigProperties config, ServletContext servletContext) {
        this.config = config;
        this.contextPath = servletContext.getContextPath();
    }

    @GetMapping(path="/")
    public String index() {
        return "test.vm";
    }

    @GetMapping(path="/{corpus}/search")
    public Object search() {
        return "test.vm";
    }

    @ModelAttribute
    @RequestMapping("/{corpus}")
    public void addBaseAttributes(
            Model model,
            @PathVariable(required = false) String corpus,
            @Autowired BlackLabApi api
    ) throws Exception {
        return;
//        Optional<CorpusConfig> corpusConfig = Result.success(corpus).flatMap(api::getCorpusConfig).getResult();
//        WebsiteConfig websiteConfig = Result.from(CorpusFileUtil.getProjectFile(
//                config.getCorporaInterfaceDataDir(),
//                Optional.of(corpus),
//                Optional.of(config.getCorporaInterfaceDefault()),
//                "search.xml"
//        ))
//        .mapWithErrorHandling(f -> new WebsiteConfig(f, corpusConfig, contextPath))
//        .getOrThrow();
//
//
//        model.addAttribute("esc", new EscapeTool());
//        model.addAttribute("date", new DateTool());
//        model.addAttribute("cache", "null"); // todo ?cache=1 parameter for scripts etc.
//        model.addAttribute("websiteConfig", websiteConfig);
//        model.addAttribute("buildTime", "todo");
//        model.addAttribute("jspath", config.getJspath());
//        model.addAttribute("googleAnalyticsKey", websiteConfig.getAnalyticsKey());
//        model.addAttribute("page", "test");

        // todo rest of baseresponse work.
    }


}
