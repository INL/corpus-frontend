<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xpath-default-namespace="http://ilk.uvt.nl/folia">
    <xsl:output encoding="utf-8" method="html" omit-xml-declaration="yes" />
    <xsl:param name="source_images" select="''"/>

	<xsl:template match="//*[local-name()='error']">
		<h1>Error</h1>
        <xsl:value-of select="//*[local-name()='message']" />
        (Error code: <xsl:value-of select="//*[local-name()='code']" />)
	</xsl:template>
	    
    <xsl:template match="//*[local-name()='metadata']" />
    
    <xsl:template match="//*[local-name()='text']">
       	<xsl:choose>
            <xsl:when test="$source_images != ''">
	            <ul class="nav nav-tabs" id="articletabs">
	                <li class="active">
	                    <a href="#text" data-toggle="tab">Text</a>
	                </li>
	                <li>
	                    <a href="#images" data-toggle="tab">Images</a>
	                </li>
	            </ul>
	            
	            <div class="tab-content">
	                <div class="tab-pane active" id="text">
	                    <xsl:apply-templates />
	                </div>
	                <div class="tab-pane" id="images">
	                    <xsl:for-each select="//*[local-name()='interpGrp' and @type='images']">
	                        <xsl:for-each select=".//*[local-name()='interp']">
	                            <img class="img-polaroid"><xsl:attribute name="src"><xsl:value-of select="$source_images"/><xsl:value-of select="@value"/></xsl:attribute></img>
	                            <br/>
	                        </xsl:for-each>
	                    </xsl:for-each>
	                </div>
	            </div>
			</xsl:when>
			<xsl:otherwise>
				<xsl:apply-templates/>
			</xsl:otherwise>
       	</xsl:choose>
    </xsl:template>
    
    <xsl:template match="//*[local-name()='head']">
        <b>
            <xsl:apply-templates />
        </b>
    </xsl:template>
    
    <xsl:template match="//*[local-name()='p']">
        <p>
            <xsl:apply-templates />
        </p>
    </xsl:template>
    
    <!-- We show w/t explicitly. Don't also show t elements for paragraphs or sentences --> 
    <xsl:template match="//*[local-name()='p' or local-name()='s']/*[local-name()='t']"/>
    
    <xsl:template match="//*[local-name()='w']">
        <xsl:variable name="lemma" select="./*[local-name()='lemma' and @class]/@class[0]"/>
        <span class="word" ref="tooltip">
            <xsl:attribute name="title">
                <xsl:value-of select="$lemma" />
            </xsl:attribute>
            <xsl:value-of select="./*[local-name()='t']" />
        </span>
        <xsl:text> </xsl:text>
    </xsl:template>
  

  	<xsl:template match="//*[local-name()='hl']">
		<span class="hl">
			<xsl:apply-templates />
		</span>
	</xsl:template>
    
</xsl:stylesheet>