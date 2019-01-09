<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xpath-default-namespace="http://www.tei-c.org/ns/1.0">
	<xsl:output encoding="utf-8" method="html" omit-xml-declaration="yes" />
	<xsl:param name="source_images" select="''"/>

	<xsl:template match="//*[local-name()='error']">
		<h1>Error</h1>
        <xsl:value-of select="//*[local-name()='message']" />
        (Error code: <xsl:value-of select="//*[local-name()='code']" />)
	</xsl:template>
	
	<xsl:template match="//*[local-name()='teiHeader']" />

	<xsl:template match="//*[local-name()='body']">
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
								<img class="img-polaroid"><xsl:attribute name="src"><xsl:value-of select="$source_images"/><xsl:value-of select="./@value"/></xsl:attribute></img>
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
	
	<xsl:template match="//*[local-name()='p']">
		<p>
			<xsl:apply-templates />
		</p>
	</xsl:template>
	
	<xsl:template match="lb">
		<br/>
		
		<xsl:variable name="number" select="@n" />
		<xsl:if test="$number">
			<span class="linenumber"><xsl:value-of select="$number" /></span>
		</xsl:if>
	</xsl:template>
	
    <xsl:template match="//*[local-name()='w']">
		<xsl:variable name="lemma" select="@lemma" />
		<span class="word" data-toggle="tooltip">
			<xsl:attribute name="data-lemma">
				<xsl:value-of select="$lemma" />
			</xsl:attribute>
			<xsl:value-of select="." />
		</span>
		<xsl:text> </xsl:text>
	</xsl:template>

	<xsl:template match="//*[local-name()='del']">
	<span style="text-decoration:line-through"><xsl:apply-templates/></span>
	</xsl:template>  

  	<xsl:template match="//*[local-name()='hl']">
		<span class="hl">
			<xsl:apply-templates />
		</span>
	</xsl:template>
	
</xsl:stylesheet>
