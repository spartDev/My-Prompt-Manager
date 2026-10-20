<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Draw.io C4 Templates

Complete draw.io XML templates for each C4 level and supplementary diagram type.
All templates use the Sanofi color palette, numeric cell IDs, 3-line element labels,
and include a legend.

## Table of Contents

- [3-Line Element Label Format](#3-line-element-label-format)
- [Level 1: System Context Template](#level-1-system-context-template)
- [Level 2: Container Template](#level-2-container-template)
- [Level 3: Component Template](#level-3-component-template)
- [Deployment Diagram Template](#deployment-diagram-template)
- [Dynamic Diagram Template](#dynamic-diagram-template)
- [Legend Template (Standalone)](#legend-template-standalone)
- [Sanofi Color Palette Summary](#sanofi-color-palette-summary)

---

## 3-Line Element Label Format

Every element in a C4 diagram uses this label structure:

```html
<b>Element Name</b><br>[Type: Technology]<br><br><font style="font-size:11px">Short description of<br>key responsibilities</font>
```

For persons (no technology):
```html
<b>Role Name</b><br>[Person]<br><br><font style="font-size:11px">Description of how<br>this person uses the system</font>
```

---

## Level 1: System Context Template

```xml
<mxfile host="draw.io">
  <diagram name="System Context" id="ctx">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="&lt;b&gt;System Context diagram for {System Name}&lt;/b&gt;" style="text;html=1;align=left;verticalAlign=top;fontSize=16;fontColor=#333333;" vertex="1" parent="1">
          <mxGeometry x="40" y="20" width="500" height="30" as="geometry"/>
        </mxCell>
        <mxCell id="3" value="&lt;b&gt;{User Role}&lt;/b&gt;&lt;br&gt;[Person]&lt;br&gt;&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;{Description of user&lt;br&gt;and their goals}&lt;/font&gt;" style="shape=mxgraph.c4.person2;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#0047BB;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="480" y="60" width="200" height="180" as="geometry"/>
        </mxCell>
        <mxCell id="4" value="&lt;b&gt;{System Name} System&lt;/b&gt;&lt;br&gt;[Software System]&lt;br&gt;&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;{System description providing&lt;br&gt;primary capability to users}&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#0047BB;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="400" y="330" width="360" height="180" as="geometry"/>
        </mxCell>
        <mxCell id="5" value="&lt;b&gt;{External System}&lt;/b&gt;&lt;br&gt;[Software System]&lt;br&gt;&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;{Description of external&lt;br&gt;system and its role}&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#6D6E71;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="40" y="330" width="260" height="180" as="geometry"/>
        </mxCell>
        <mxCell id="6" value="&lt;b&gt;{External System 2}&lt;/b&gt;&lt;br&gt;[Software System]&lt;br&gt;&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;{Description of external&lt;br&gt;system and its role}&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#6D6E71;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="860" y="330" width="260" height="180" as="geometry"/>
        </mxCell>
        <mxCell id="7" value="{Describes relationship}" style="endArrow=blockThin;endFill=1;html=1;fontSize=11;fontColor=#707070;strokeColor=#707070;exitX=0.5;exitY=1;entryX=0.5;entryY=0;" edge="1" parent="1" source="3" target="4">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="8" value="{Sends data to}" style="endArrow=blockThin;endFill=1;html=1;fontSize=11;fontColor=#707070;strokeColor=#707070;exitX=0;exitY=0.5;entryX=1;entryY=0.5;" edge="1" parent="1" source="4" target="5">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="9" value="{Fetches data from}" style="endArrow=blockThin;endFill=1;html=1;fontSize=11;fontColor=#707070;strokeColor=#707070;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" parent="1" source="4" target="6">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="10" value="&lt;b&gt;Legend&lt;/b&gt;&lt;br&gt;Blue = System in scope&lt;br&gt;Grey = External system&lt;br&gt;Person shape = Human user&lt;br&gt;Solid arrow = Relationship" style="text;html=1;align=left;verticalAlign=top;fontSize=11;fontColor=#333333;fillColor=#F5F5F5;strokeColor=#CCCCCC;rounded=1;" vertex="1" parent="1">
          <mxGeometry x="860" y="600" width="260" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="11" value="v{X.Y.Z} | {YYYY-MM-DD}" style="text;html=1;align=right;verticalAlign=bottom;fontSize=10;fontColor=#999999;" vertex="1" parent="1">
          <mxGeometry x="860" y="720" width="260" height="20" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

---

## Level 2: Container Template

```xml
<mxfile host="draw.io">
  <diagram name="Container Diagram" id="cont">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="&lt;b&gt;Container diagram for {System Name}&lt;/b&gt;" style="text;html=1;align=left;verticalAlign=top;fontSize=16;fontColor=#333333;" vertex="1" parent="1">
          <mxGeometry x="40" y="20" width="500" height="30" as="geometry"/>
        </mxCell>
        <mxCell id="3" value="{System Name}" style="rounded=1;dashed=1;dashPattern=8 8;whiteSpace=wrap;html=1;align=left;verticalAlign=top;fontSize=14;fillColor=none;strokeColor=#888888;fontColor=#444444;arcSize=5;" vertex="1" parent="1">
          <mxGeometry x="120" y="200" width="920" height="500" as="geometry"/>
        </mxCell>
        <mxCell id="4" value="&lt;b&gt;{User Role}&lt;/b&gt;&lt;br&gt;[Person]&lt;br&gt;&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;{Description}&lt;/font&gt;" style="shape=mxgraph.c4.person2;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#0047BB;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="480" y="40" width="200" height="140" as="geometry"/>
        </mxCell>
        <mxCell id="5" value="&lt;b&gt;{Web Application}&lt;/b&gt;&lt;br&gt;[Container: React / TypeScript]&lt;br&gt;&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;Delivers the SPA to&lt;br&gt;the user's browser&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#4B9CD3;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="160" y="240" width="280" height="140" as="geometry"/>
        </mxCell>
        <mxCell id="6" value="&lt;b&gt;{API Service}&lt;/b&gt;&lt;br&gt;[Container: Fastify / TypeScript]&lt;br&gt;&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;Handles business logic and&lt;br&gt;API endpoints&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#4B9CD3;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="560" y="240" width="280" height="140" as="geometry"/>
        </mxCell>
        <mxCell id="7" value="&lt;b&gt;{Database}&lt;/b&gt;&lt;br&gt;[Container: PostgreSQL]&lt;br&gt;&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;Stores user data and&lt;br&gt;application state&lt;/font&gt;" style="shape=cylinder3;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#4B9CD3;fontColor=#ffffff;strokeColor=none;size=15;boundedLbl=1;" vertex="1" parent="1">
          <mxGeometry x="360" y="480" width="200" height="160" as="geometry"/>
        </mxCell>
        <mxCell id="8" value="&lt;b&gt;{Message Queue}&lt;/b&gt;&lt;br&gt;[Container: SQS]&lt;br&gt;&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;Decouples async&lt;br&gt;processing&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#4B9CD3;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="700" y="480" width="200" height="140" as="geometry"/>
        </mxCell>
        <mxCell id="9" value="Delivers content to&lt;br&gt;[HTTPS]" style="endArrow=blockThin;endFill=1;html=1;fontSize=11;fontColor=#707070;strokeColor=#707070;" edge="1" parent="1" source="5" target="4">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="10" value="Fetches data via&lt;br&gt;[HTTP/REST JSON]" style="endArrow=blockThin;endFill=1;html=1;fontSize=11;fontColor=#707070;strokeColor=#707070;" edge="1" parent="1" source="5" target="6">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="11" value="Reads/writes data&lt;br&gt;[SQL/TCP]" style="endArrow=blockThin;endFill=1;html=1;fontSize=11;fontColor=#707070;strokeColor=#707070;" edge="1" parent="1" source="6" target="7">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="12" value="Publishes events to&lt;br&gt;[AMQP]" style="endArrow=blockThin;endFill=1;dashed=1;html=1;fontSize=11;fontColor=#707070;strokeColor=#707070;" edge="1" parent="1" source="6" target="8">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="13" value="&lt;b&gt;{External System}&lt;/b&gt;&lt;br&gt;[Software System]&lt;br&gt;&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;{Description}&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#6D6E71;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="960" y="240" width="220" height="140" as="geometry"/>
        </mxCell>
        <mxCell id="14" value="&lt;b&gt;Legend&lt;/b&gt;&lt;br&gt;Blue = Container (this system)&lt;br&gt;Grey = External system&lt;br&gt;Person = Human user&lt;br&gt;Cylinder = Data store&lt;br&gt;Solid arrow = Synchronous&lt;br&gt;Dashed arrow = Asynchronous&lt;br&gt;Labels = [Protocol]" style="text;html=1;align=left;verticalAlign=top;fontSize=11;fontColor=#333333;fillColor=#F5F5F5;strokeColor=#CCCCCC;rounded=1;" vertex="1" parent="1">
          <mxGeometry x="880" y="600" width="260" height="130" as="geometry"/>
        </mxCell>
        <mxCell id="15" value="v{X.Y.Z} | {YYYY-MM-DD}" style="text;html=1;align=right;verticalAlign=bottom;fontSize=10;fontColor=#999999;" vertex="1" parent="1">
          <mxGeometry x="880" y="740" width="260" height="20" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

---

## Level 3: Component Template

```xml
<mxfile host="draw.io">
  <diagram name="Component Diagram" id="comp">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="&lt;b&gt;Component diagram for {Container Name}&lt;/b&gt;" style="text;html=1;align=left;verticalAlign=top;fontSize=16;fontColor=#333333;" vertex="1" parent="1">
          <mxGeometry x="40" y="20" width="500" height="30" as="geometry"/>
        </mxCell>
        <mxCell id="3" value="{Container Name}" style="rounded=1;dashed=1;dashPattern=8 8;whiteSpace=wrap;html=1;align=left;verticalAlign=top;fontSize=14;fillColor=none;strokeColor=#888888;fontColor=#444444;arcSize=5;" vertex="1" parent="1">
          <mxGeometry x="120" y="80" width="920" height="620" as="geometry"/>
        </mxCell>
        <mxCell id="4" value="&lt;b&gt;{Controller}&lt;/b&gt;&lt;br&gt;[Component: Fastify Routes]&lt;br&gt;&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;Handles HTTP requests&lt;br&gt;and input validation&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#00A3E0;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="400" y="120" width="280" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="5" value="&lt;b&gt;{Service}&lt;/b&gt;&lt;br&gt;[Component: TypeScript]&lt;br&gt;&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;Implements business logic&lt;br&gt;and orchestration&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#00A3E0;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="400" y="300" width="280" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="6" value="&lt;b&gt;{Repository}&lt;/b&gt;&lt;br&gt;[Component: Drizzle ORM]&lt;br&gt;&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;Data access layer for&lt;br&gt;database operations&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#00A3E0;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="400" y="480" width="280" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="7" value="&lt;b&gt;{Auth Middleware}&lt;/b&gt;&lt;br&gt;[Component: JWT / OIDC]&lt;br&gt;&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;Validates tokens and&lt;br&gt;enforces access control&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#00A3E0;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="160" y="200" width="200" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="8" value="Delegates to" style="endArrow=blockThin;endFill=1;html=1;fontSize=11;fontColor=#707070;strokeColor=#707070;" edge="1" parent="1" source="4" target="5">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="9" value="Queries via" style="endArrow=blockThin;endFill=1;html=1;fontSize=11;fontColor=#707070;strokeColor=#707070;" edge="1" parent="1" source="5" target="6">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="10" value="Validates requests via" style="endArrow=blockThin;endFill=1;html=1;fontSize=11;fontColor=#707070;strokeColor=#707070;" edge="1" parent="1" source="4" target="7">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="11" value="&lt;b&gt;{Database}&lt;/b&gt;&lt;br&gt;[Container: PostgreSQL]" style="shape=cylinder3;whiteSpace=wrap;html=1;align=center;fontSize=12;fillColor=#4B9CD3;fontColor=#ffffff;strokeColor=none;size=15;boundedLbl=1;" vertex="1" parent="1">
          <mxGeometry x="440" y="660" width="200" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="12" value="Reads/writes data [SQL]" style="endArrow=blockThin;endFill=1;html=1;fontSize=11;fontColor=#707070;strokeColor=#707070;" edge="1" parent="1" source="6" target="11">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="13" value="&lt;b&gt;Legend&lt;/b&gt;&lt;br&gt;Teal = Component&lt;br&gt;Blue = Container (context)&lt;br&gt;Solid arrow = Synchronous call&lt;br&gt;Dashed border = Container boundary" style="text;html=1;align=left;verticalAlign=top;fontSize=11;fontColor=#333333;fillColor=#F5F5F5;strokeColor=#CCCCCC;rounded=1;" vertex="1" parent="1">
          <mxGeometry x="800" y="620" width="230" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="14" value="v{X.Y.Z} | {YYYY-MM-DD}" style="text;html=1;align=right;verticalAlign=bottom;fontSize=10;fontColor=#999999;" vertex="1" parent="1">
          <mxGeometry x="800" y="730" width="230" height="20" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

---

## Deployment Diagram Template

```xml
<mxfile host="draw.io">
  <diagram name="Deployment Diagram" id="deploy">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="&lt;b&gt;Deployment diagram for {System Name} - Production&lt;/b&gt;" style="text;html=1;align=left;verticalAlign=top;fontSize=16;fontColor=#333333;" vertex="1" parent="1">
          <mxGeometry x="40" y="20" width="600" height="30" as="geometry"/>
        </mxCell>
        <mxCell id="3" value="AWS eu-west-1" style="rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=top;fontSize=14;fillColor=#FFFFFF;strokeColor=#888888;fontColor=#000000;arcSize=5;dashed=1;" vertex="1" parent="1">
          <mxGeometry x="80" y="80" width="1000" height="640" as="geometry"/>
        </mxCell>
        <mxCell id="4" value="Availability Zone eu-west-1a" style="rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=top;fontSize=12;fillColor=#FFFFFF;strokeColor=#888888;fontColor=#666666;dashed=1;" vertex="1" parent="1">
          <mxGeometry x="120" y="120" width="440" height="560" as="geometry"/>
        </mxCell>
        <mxCell id="5" value="ECS Cluster" style="rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=top;fontSize=12;fillColor=#FFFFFF;strokeColor=#888888;fontColor=#666666;" vertex="1" parent="1">
          <mxGeometry x="160" y="170" width="360" height="200" as="geometry"/>
        </mxCell>
        <mxCell id="6" value="&lt;b&gt;{API Service}&lt;/b&gt;&lt;br&gt;[Container: Fastify]&lt;br&gt;&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;x2 tasks&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;align=center;fontSize=12;fillColor=#4B9CD3;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="200" y="220" width="260" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="7" value="&lt;b&gt;RDS PostgreSQL&lt;/b&gt;&lt;br&gt;[Container: PostgreSQL 16]&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;Multi-AZ, encrypted at rest&lt;/font&gt;" style="shape=cylinder3;whiteSpace=wrap;html=1;align=center;fontSize=12;fillColor=#4B9CD3;fontColor=#ffffff;strokeColor=none;size=15;boundedLbl=1;" vertex="1" parent="1">
          <mxGeometry x="200" y="450" width="260" height="140" as="geometry"/>
        </mxCell>
        <mxCell id="8" value="&lt;b&gt;ALB&lt;/b&gt;&lt;br&gt;[Infrastructure: Application Load Balancer]" style="rounded=1;whiteSpace=wrap;html=1;align=center;fontSize=12;fillColor=#FFFFFF;strokeColor=#888888;fontColor=#000000;" vertex="1" parent="1">
          <mxGeometry x="620" y="220" width="280" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="9" value="&lt;b&gt;Lambda&lt;/b&gt;&lt;br&gt;[Container: Node.js 20]&lt;br&gt;&lt;font style=&quot;font-size:11px&quot;&gt;Event processor&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;align=center;fontSize=12;fillColor=#4B9CD3;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="650" y="380" width="220" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="10" value="Routes traffic to [HTTPS]" style="endArrow=blockThin;endFill=1;html=1;fontSize=11;fontColor=#707070;strokeColor=#707070;" edge="1" parent="1" source="8" target="6">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="11" value="&lt;b&gt;Legend&lt;/b&gt;&lt;br&gt;Blue = Container instance&lt;br&gt;White box = Deployment node&lt;br&gt;Dashed = Region/AZ boundary&lt;br&gt;Cylinder = Data store" style="text;html=1;align=left;verticalAlign=top;fontSize=11;fontColor=#333333;fillColor=#F5F5F5;strokeColor=#CCCCCC;rounded=1;" vertex="1" parent="1">
          <mxGeometry x="860" y="600" width="200" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="12" value="v{X.Y.Z} | {YYYY-MM-DD}" style="text;html=1;align=right;verticalAlign=bottom;fontSize=10;fontColor=#999999;" vertex="1" parent="1">
          <mxGeometry x="860" y="720" width="200" height="20" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

---

## Dynamic Diagram Template

```xml
<mxfile host="draw.io">
  <diagram name="Dynamic Diagram" id="dyn">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="&lt;b&gt;Dynamic diagram for {Feature/Use Case Name}&lt;/b&gt;" style="text;html=1;align=left;verticalAlign=top;fontSize=16;fontColor=#333333;" vertex="1" parent="1">
          <mxGeometry x="40" y="20" width="600" height="30" as="geometry"/>
        </mxCell>
        <mxCell id="3" value="&lt;b&gt;{User}&lt;/b&gt;&lt;br&gt;[Person]" style="shape=mxgraph.c4.person2;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#0047BB;fontColor=#ffffff;strokeColor=none;" vertex="1" parent="1">
          <mxGeometry x="60" y="200" width="140" height="140" as="geometry"/>
        </mxCell>
        <mxCell id="4" value="&lt;b&gt;{Web App}&lt;/b&gt;&lt;br&gt;[Container: React]" style="rounded=1;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#4B9CD3;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="300" y="220" width="200" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="5" value="&lt;b&gt;{API}&lt;/b&gt;&lt;br&gt;[Container: Fastify]" style="rounded=1;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#4B9CD3;fontColor=#ffffff;strokeColor=none;arcSize=10;" vertex="1" parent="1">
          <mxGeometry x="600" y="220" width="200" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="6" value="&lt;b&gt;{Database}&lt;/b&gt;&lt;br&gt;[Container: PostgreSQL]" style="shape=cylinder3;whiteSpace=wrap;html=1;align=center;fontSize=13;fillColor=#4B9CD3;fontColor=#ffffff;strokeColor=none;size=15;boundedLbl=1;" vertex="1" parent="1">
          <mxGeometry x="900" y="210" width="160" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="7" value="1. Submits form" style="endArrow=blockThin;endFill=1;html=1;fontSize=11;fontColor=#707070;strokeColor=#707070;" edge="1" parent="1" source="3" target="4">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="8" value="2. POST /api/orders [HTTP]" style="endArrow=blockThin;endFill=1;html=1;fontSize=11;fontColor=#707070;strokeColor=#707070;" edge="1" parent="1" source="4" target="5">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="9" value="3. INSERT order [SQL]" style="endArrow=blockThin;endFill=1;html=1;fontSize=11;fontColor=#707070;strokeColor=#707070;" edge="1" parent="1" source="5" target="6">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="10" value="&lt;b&gt;Legend&lt;/b&gt;&lt;br&gt;Numbers = Interaction order&lt;br&gt;Solid arrow = Synchronous call" style="text;html=1;align=left;verticalAlign=top;fontSize=11;fontColor=#333333;fillColor=#F5F5F5;strokeColor=#CCCCCC;rounded=1;" vertex="1" parent="1">
          <mxGeometry x="860" y="440" width="200" height="80" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

---

## Legend Template (Standalone)

For diagrams requiring a detailed legend:

```xml
<mxCell id="100" value="" style="rounded=1;fillColor=#F5F5F5;strokeColor=#CCCCCC;arcSize=5;" vertex="1" parent="1">
  <mxGeometry x="820" y="560" width="300" height="200" as="geometry"/>
</mxCell>
<mxCell id="101" value="&lt;b&gt;Legend&lt;/b&gt;" style="text;html=1;fontSize=13;fontColor=#333333;" vertex="1" parent="1">
  <mxGeometry x="830" y="570" width="100" height="20" as="geometry"/>
</mxCell>
<mxCell id="102" value="" style="rounded=1;fillColor=#0047BB;strokeColor=none;" vertex="1" parent="1">
  <mxGeometry x="840" y="600" width="20" height="15" as="geometry"/>
</mxCell>
<mxCell id="103" value="Person / System (in scope)" style="text;html=1;fontSize=11;fontColor=#333333;" vertex="1" parent="1">
  <mxGeometry x="870" y="598" width="200" height="18" as="geometry"/>
</mxCell>
<mxCell id="104" value="" style="rounded=1;fillColor=#4B9CD3;strokeColor=none;" vertex="1" parent="1">
  <mxGeometry x="840" y="625" width="20" height="15" as="geometry"/>
</mxCell>
<mxCell id="105" value="Container" style="text;html=1;fontSize=11;fontColor=#333333;" vertex="1" parent="1">
  <mxGeometry x="870" y="623" width="200" height="18" as="geometry"/>
</mxCell>
<mxCell id="106" value="" style="rounded=1;fillColor=#00A3E0;strokeColor=none;" vertex="1" parent="1">
  <mxGeometry x="840" y="650" width="20" height="15" as="geometry"/>
</mxCell>
<mxCell id="107" value="Component" style="text;html=1;fontSize=11;fontColor=#333333;" vertex="1" parent="1">
  <mxGeometry x="870" y="648" width="200" height="18" as="geometry"/>
</mxCell>
<mxCell id="108" value="" style="rounded=1;fillColor=#6D6E71;strokeColor=none;" vertex="1" parent="1">
  <mxGeometry x="840" y="675" width="20" height="15" as="geometry"/>
</mxCell>
<mxCell id="109" value="External System" style="text;html=1;fontSize=11;fontColor=#333333;" vertex="1" parent="1">
  <mxGeometry x="870" y="673" width="200" height="18" as="geometry"/>
</mxCell>
<mxCell id="110" value="____" style="text;html=1;fontSize=11;fontColor=#707070;" vertex="1" parent="1">
  <mxGeometry x="840" y="698" width="20" height="18" as="geometry"/>
</mxCell>
<mxCell id="111" value="Solid = Synchronous | Dashed = Async" style="text;html=1;fontSize=11;fontColor=#333333;" vertex="1" parent="1">
  <mxGeometry x="870" y="698" width="240" height="18" as="geometry"/>
</mxCell>
```

---

## Sanofi Color Palette Summary

| Element | Hex | RGB | Usage |
|---------|-----|-----|-------|
| Sanofi Blue | #0047BB | 0, 71, 187 | Person, System (in scope) |
| Sanofi Light Blue | #4B9CD3 | 75, 156, 211 | Container |
| Sanofi Teal | #00A3E0 | 0, 163, 224 | Component |
| Sanofi Gray | #6D6E71 | 109, 110, 113 | External System |
| Arrow/Label | #707070 | 112, 112, 112 | Relationship arrows and labels |
| Boundary Border | #888888 | 136, 136, 136 | System boundary, deployment nodes |
| Boundary Text | #444444 | 68, 68, 68 | Boundary box labels |
| Legend Background | #F5F5F5 | 245, 245, 245 | Legend box fill |
