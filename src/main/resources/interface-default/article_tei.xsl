<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xpath-default-namespace="http://www.tei-c.org/ns/1.0">
	<xsl:output encoding="utf-8" method="html" omit-xml-declaration="yes" />

	<xsl:template match="//*[local-name()='error']">
		<h1>Error</h1>
		<xsl:value-of select="//*[local-name()='message']" />
		(Error code: <xsl:value-of select="//*[local-name()='code']" />)
	</xsl:template>

	<xsl:template match="//*[local-name()='teiHeader']" />

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
