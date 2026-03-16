// Example parametric model (for reference)
width = 40;
height = 10;
hole_radius = 3;

difference() {
    cube([width, height, 10]);

    translate([width/2, height/2, 0])
        cylinder(h=10, r=hole_radius);
}

