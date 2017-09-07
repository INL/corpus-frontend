<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:folia="http://ilk.uvt.nl/folia">

    <xsl:output encoding="utf-8" method="html" omit-xml-declaration="yes" />
    <xsl:param name="source_images" select="''"/>

    <xsl:template match="error|folia:error">
        <h1>Error</h1>
        <xsl:value-of select="message|folia:message" />
        (Error code: <xsl:value-of select="code|folia:code" />)
    </xsl:template>
    
    <xsl:template match="metadata|folia:metadata" />
    
    <xsl:template match="text|folia:text">
        <div class="col-xs-12 contentbox">
            <ul class="nav nav-tabs" id="articletabs">
                <li class="active">
                    <a href="#text" data-toggle="tab">Text</a>
                </li>
                <xsl:if test="$source_images != ''">
                <li>
                    <a href="#images" data-toggle="tab">Images</a>
                </li>
                </xsl:if>
            </ul>
            
            <div class="tab-content">
                <div class="tab-pane active" id="text">
                    <xsl:apply-templates />
                </div>
                <xsl:if test="$source_images != ''">
                <div class="tab-pane" id="images">
                    <xsl:for-each select="//interpGrp[@type='images']|//folia:interpGrp[@type='images']">
                        <xsl:for-each select=".//interp|.//folia:interp">
                            <img class="img-polaroid"><xsl:attribute name="src"><xsl:value-of select="$source_images"/><xsl:value-of select="@value"/></xsl:attribute></img>
                            <br/>
                        </xsl:for-each>
                    </xsl:for-each>
                </div>
                </xsl:if>
            </div>          
        </div>
    </xsl:template>
    
    <xsl:template match="head|folia:head">
        <b>
            <xsl:apply-templates />
        </b>
    </xsl:template>
    
    <xsl:template match="p|folia:p">
        <p>
            <xsl:apply-templates />
        </p>
    </xsl:template>
    
    <!-- We show w/t explicitly. Don't also show t elements for paragraphs or sentences --> 
    <xsl:template match="p/t|folia:p/folia:t|s/t|folia:s/folia:t"/>
    
    <xsl:template match="w|folia:w">
        <xsl:variable name="lemma" select="lemma/@class|folia:lemma/@class" />
        <span class="word" ref="tooltip">
            <xsl:attribute name="title">
                <xsl:value-of select="$lemma" />
            </xsl:attribute>
            <xsl:value-of select="folia:t" />
        </span>
        <xsl:text> </xsl:text>
    </xsl:template>
  
    <xsl:template match="hl|folia:hl">
        <a>
            <xsl:attribute name="name">
                <xsl:value-of select="generate-id()" />
            </xsl:attribute>
            <xsl:attribute name="class">anchor hl</xsl:attribute>
            <xsl:apply-templates />
        </a>
    </xsl:template>
    
</xsl:stylesheet>