<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:folia="http://ilk.uvt.nl/folia">
    <xsl:output encoding="utf-8" method="html" omit-xml-declaration="yes" />
    <xsl:param name="title_name" select="'#'"/>
    <xsl:param name="source_images" select="''"/>

    <xsl:template match="error">
        <h1>Error</h1>
        <xsl:value-of select="message" />
        (Error code: <xsl:value-of select="code" />)
    </xsl:template>
    
    <xsl:template match="SearchSummary" />
    
    <xsl:template match="HitsInDocument">   
    </xsl:template>
    
    <xsl:template match="DocumentFields">
        <xsl:variable name="numhits" select="../HitsInDocument" />
        <div class="span12 contentbox">
            <h2>
                <xsl:value-of select="*[name()=$title_name]" />
            </h2>
            <div class="span10">
                <div class="span2">
                    <i>Hits in document:</i>
                </div>
                <div class="span7">
                    <xsl:value-of select="$numhits" />
                </div>
            </div>
            <xsl:for-each select="child::*">
                <div class="span10">
                    <div class="span2">
                        <i><xsl:value-of select="local-name()" />:</i>
                    </div>
                    <div class="span7">
                        <xsl:value-of select="."/>
                    </div>
                </div>
            </xsl:for-each> 
        </div>
    </xsl:template>
    
    <xsl:template match="folia:metadata" />
    
    <xsl:template match="text">
        <div class="span12 contentbox">
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
                    <xsl:for-each select="//interpGrp[@type='images']">
                        <xsl:for-each select=".//interp">
                            <img class="img-polaroid"><xsl:attribute name="src"><xsl:value-of select="$source_images"/><xsl:value-of select="./@value"/></xsl:attribute></img>
                            <br/>
                        </xsl:for-each>
                    </xsl:for-each>
                </div>
                </xsl:if>
            </div>          
        </div>
    </xsl:template>
    
    <xsl:template match="folia:head">
        <b>
            <xsl:apply-templates />
        </b>
    </xsl:template>
    
    <xsl:template match="folia:p">
        <p>
            <xsl:apply-templates />
        </p>
    </xsl:template>
    
    <xsl:template match="folia:w">
        <xsl:variable name="lemma" select="folia:lemma/@class" />
        <span class="word" ref="tooltip">
            <xsl:attribute name="title">
                <xsl:value-of select="$lemma" />
            </xsl:attribute>
            <xsl:value-of select="folia:t" />
        </span>
        <xsl:text> </xsl:text>
    </xsl:template>
  
    <xsl:template match="hl">
        <a>
            <xsl:attribute name="name">
                <xsl:value-of select="generate-id()" />
            </xsl:attribute>
            <xsl:attribute name="class">anchor hl</xsl:attribute>
            <xsl:apply-templates />
        </a>
    </xsl:template>
    
</xsl:stylesheet>