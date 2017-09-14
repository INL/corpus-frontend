<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xpath-default-namespace="http://ilk.uvt.nl/folia">

    <xsl:output encoding="utf-8" method="html" omit-xml-declaration="yes" />
    <xsl:param name="source_images" select="''"/>

    <xsl:template match="error">
        <h1>Error</h1>
        <xsl:value-of select="message" />
        (Error code: <xsl:value-of select="code" />)
    </xsl:template>
    
    <xsl:template match="metadata" />
    
    <xsl:template match="text">
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
                    <xsl:for-each select="//interpGrp[@type='images']">
                        <xsl:for-each select=".//interp">
                            <img class="img-polaroid"><xsl:attribute name="src"><xsl:value-of select="$source_images"/><xsl:value-of select="@value"/></xsl:attribute></img>
                            <br/>
                        </xsl:for-each>
                    </xsl:for-each>
                </div>
                </xsl:if>
            </div>          
        </div>
    </xsl:template>
    
    <xsl:template match="head">
        <b>
            <xsl:apply-templates />
        </b>
    </xsl:template>
    
    <xsl:template match="p">
        <p>
            <xsl:apply-templates />
        </p>
    </xsl:template>
    
    <!-- We show w/t explicitly. Don't also show t elements for paragraphs or sentences --> 
    <xsl:template match="p/t|s/t"/>
    
    <xsl:template match="w">
        <xsl:variable name="lemma" select="lemma/@class" />
        <span class="word" ref="tooltip">
            <xsl:attribute name="title">
                <xsl:value-of select="$lemma" />
            </xsl:attribute>
            <xsl:value-of select="t" />
        </span>
        <xsl:text> </xsl:text>
    </xsl:template>
  

  	<xsl:template match="hl">
		<span class="hl">
			<xsl:apply-templates />
		</span>
	</xsl:template>
    
</xsl:stylesheet>